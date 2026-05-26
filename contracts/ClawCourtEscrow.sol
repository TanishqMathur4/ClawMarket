// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ClawCourtEscrow
 * @notice Automated escrow and dispute-resolution contract for AI-agent
 *         machine-to-machine commerce on GOAT Network Testnet.
 *
 * @dev Flow:
 *   1. Buyer calls tUSDC.approve(escrowAddress, amount)
 *   2. Buyer (or Gateway) calls lockFunds(txId, seller, amount)
 *      → tUSDC pulled into contract; status set to PENDING
 *   3. AI Referee (Teammate 3) evaluates seller's data payload
 *   4a. PASS → Gateway calls releaseFunds(txId) → tUSDC sent to seller
 *   4b. FAIL → Gateway calls refundFunds(txId)  → tUSDC returned to buyer
 *
 * @dev Owner = Gateway wallet (Teammate 2's pipeline signing key).
 *      Transfer ownership after deploy: transferOwnership(gatewayAddress)
 */
contract ClawCourtEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Token ────────────────────────────────────────────────────────────────

    /// @notice tUSDC token contract on GOAT Testnet (6 decimals, like real USDC)
    IERC20 public immutable token;

    // ─── State ────────────────────────────────────────────────────────────────

    enum Status { PENDING, RELEASED, REFUNDED }

    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;   // in tUSDC smallest unit (6 decimals)
        Status  status;
    }

    /// @notice txId → Escrow mapping. txId is generated off-chain:
    ///         keccak256(abi.encodePacked(buyer, block.timestamp, nonce))
    mapping(bytes32 => Escrow) public escrows;

    // ─── Custom Errors ────────────────────────────────────────────────────────

    /// @dev Reverts when attempting to act on a txId that has no escrow record.
    error EscrowNotFound();

    /// @dev Reverts when the escrow status is not PENDING (prevents double-spend).
    error NotPending();

    /// @dev Reverts when the seller address is zero.
    error InvalidSeller();

    /// @dev Reverts when the amount is zero.
    error ZeroAmount();

    /// @dev Reverts when a txId is already registered (prevents collision).
    error TxIdAlreadyUsed();

    // ─── Events ───────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a buyer locks funds into escrow.
     * @param txId   Unique transaction identifier (indexed for efficient filtering)
     * @param buyer  Address that locked the funds
     * @param seller Address that will receive funds on PASS
     * @param amount Amount of tUSDC locked (in smallest unit)
     */
    event FundsLocked(
        bytes32 indexed txId,
        address indexed buyer,
        address seller,
        uint256 amount
    );

    /**
     * @notice Emitted when funds are released to the seller (Referee: PASS).
     * @param txId   Unique transaction identifier
     * @param seller Address that received the funds
     * @param amount Amount of tUSDC released
     */
    event FundsReleased(
        bytes32 indexed txId,
        address seller,
        uint256 amount
    );

    /**
     * @notice Emitted when funds are returned to the buyer (Referee: FAIL).
     * @param txId   Unique transaction identifier
     * @param buyer  Address that received the refund
     * @param amount Amount of tUSDC refunded
     */
    event FundsRefunded(
        bytes32 indexed txId,
        address buyer,
        uint256 amount
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param tokenAddress Address of the tUSDC ERC-20 contract on GOAT Testnet.
     *
     * @dev On deployment msg.sender becomes the owner (Ownable default).
     *      After deploy, call transferOwnership(gatewayWallet) so Teammate 2's
     *      pipeline key can call releaseFunds / refundFunds.
     */
    constructor(address tokenAddress) Ownable(msg.sender) {
        require(tokenAddress != address(0), "ClawCourtEscrow: zero token address");
        token = IERC20(tokenAddress);
    }

    // ─── External Functions ───────────────────────────────────────────────────

    /**
     * @notice Lock tUSDC from the buyer into escrow.
     * @dev    Buyer must have called tUSDC.approve(address(this), amount) first.
     *         Any address may call lockFunds (buyer or the Gateway on their behalf).
     *
     * @param txId   Unique off-chain generated identifier for this transaction.
     * @param seller Address that will receive funds if the Referee returns PASS.
     * @param amount Amount of tUSDC to lock (in smallest unit, 6 decimals).
     */
    function lockFunds(
        bytes32 txId,
        address seller,
        uint256 amount
    ) external nonReentrant {
        if (seller == address(0))              revert InvalidSeller();
        if (amount == 0)                        revert ZeroAmount();
        if (escrows[txId].buyer != address(0)) revert TxIdAlreadyUsed();

        escrows[txId] = Escrow({
            buyer:  msg.sender,
            seller: seller,
            amount: amount,
            status: Status.PENDING
        });

        // SafeERC20 handles reverts on failed transfer (no silent failures)
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit FundsLocked(txId, msg.sender, seller, amount);
    }

    /**
     * @notice Release locked funds to the seller (AI Referee verdict: PASS).
     * @dev    Only callable by the contract owner (Gateway wallet).
     *         Reverts if the escrow is not in PENDING state.
     *
     * @param txId Unique transaction identifier to settle.
     */
    function releaseFunds(bytes32 txId) external onlyOwner nonReentrant {
        Escrow storage escrow = _requirePending(txId);

        escrow.status = Status.RELEASED;
        token.safeTransfer(escrow.seller, escrow.amount);

        emit FundsReleased(txId, escrow.seller, escrow.amount);
    }

    /**
     * @notice Refund locked funds to the buyer (AI Referee verdict: FAIL).
     * @dev    Only callable by the contract owner (Gateway wallet).
     *         Reverts if the escrow is not in PENDING state.
     *
     * @param txId Unique transaction identifier to settle.
     */
    function refundFunds(bytes32 txId) external onlyOwner nonReentrant {
        Escrow storage escrow = _requirePending(txId);

        escrow.status = Status.REFUNDED;
        token.safeTransfer(escrow.buyer, escrow.amount);

        emit FundsRefunded(txId, escrow.buyer, escrow.amount);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Returns the current status of an escrow as a uint8.
     * @dev    0 = PENDING, 1 = RELEASED, 2 = REFUNDED.
     *         Returns 0 for unknown txIds (same as PENDING) — callers should
     *         check escrows[txId].buyer != address(0) to confirm existence.
     *
     * @param txId Unique transaction identifier.
     */
    function getStatus(bytes32 txId) external view returns (uint8) {
        return uint8(escrows[txId].status);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    /**
     * @dev Validates the escrow exists and is PENDING. Returns storage ref.
     *      Reverts with EscrowNotFound if buyer is zero address.
     *      Reverts with NotPending if status != PENDING.
     */
    function _requirePending(bytes32 txId) internal view returns (Escrow storage escrow) {
        escrow = escrows[txId];
        if (escrow.buyer == address(0)) revert EscrowNotFound();
        if (escrow.status != Status.PENDING) revert NotPending();
    }
}
