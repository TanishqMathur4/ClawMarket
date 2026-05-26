// test/ClawCourtEscrow.test.js
// ── T1: Unit tests for ClawCourtEscrow.sol ────────────────────────────────
//
// Run:  npx hardhat test
//       npx hardhat test --grep "happy path"   ← run one test
//
// Coverage: deployment, lockFunds, releaseFunds, refundFunds,
//           getStatus, all revert guards, full integration paths.
//
// Ethers v6 API notes:
//   - contract.target  (not .address)
//   - contract.waitForDeployment()  (not .deployed())
//   - balanceOf() returns native bigint  (no .toBigInt() needed)
//   - uint8 / enum values from getter calls return bigint

const { expect } = require("chai");
const hre        = require("hardhat");
const crypto     = require("crypto");

// ─── Constants (BigInt literals — no ethers needed at module scope) ─────────

const AMOUNT         = 50_000_000n;     // 50 tUSDC  (6 decimals)
const INITIAL_SUPPLY = 10_000_000_000n; // 10 000 tUSDC
const ZERO_ADDRESS   = "0x0000000000000000000000000000000000000000";
const MAX_UINT256    = 2n ** 256n - 1n;

// Mirrors the Solidity Status enum — bigint to match ethers v6 return type
const Status = { PENDING: 0n, RELEASED: 1n, REFUNDED: 2n };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Random bytes32 — same entropy as the off-chain demo key generator. */
function makeTxId() {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

// ─── Shared deploy helper ───────────────────────────────────────────────────

async function deployAll() {
  const { ethers } = hre;
  const [owner, buyer, seller, other] = await ethers.getSigners();

  // Deploy MockERC20 (tUSDC stand-in, 6 decimals)
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy("Test USDC", "tUSDC", 6);
  await token.waitForDeployment();                       // ethers v6: waitForDeployment()
  await token.mint(buyer.address, INITIAL_SUPPLY);

  // Deploy ClawCourtEscrow, pass token address via .target (ethers v6)
  const ClawCourtEscrow = await ethers.getContractFactory("ClawCourtEscrow");
  const escrow = await ClawCourtEscrow.deploy(token.target);
  await escrow.waitForDeployment();

  // Buyer pre-approves max so individual tests don't need to repeat it
  await token.connect(buyer).approve(escrow.target, MAX_UINT256);

  return { escrow, token, owner, buyer, seller, other };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ClawCourtEscrow", function () {

  // ── 1. Deployment ──────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets the token address correctly", async function () {
      const { escrow, token } = await deployAll();
      expect(await escrow.token()).to.equal(token.target);   // ethers v6: .target
    });

    it("sets the deployer as owner", async function () {
      const { escrow, owner } = await deployAll();
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it("reverts when token address is zero", async function () {
      const { ethers } = hre;
      const ClawCourtEscrow = await ethers.getContractFactory("ClawCourtEscrow");
      await expect(ClawCourtEscrow.deploy(ZERO_ADDRESS))
        .to.be.revertedWith("ClawCourtEscrow: zero token address");
    });
  });

  // ── 2. lockFunds ───────────────────────────────────────────────────────────

  describe("lockFunds", function () {
    it("pulls tokens from buyer into the contract", async function () {
      const { escrow, token, buyer, seller } = await deployAll();
      const txId = makeTxId();

      // ethers v6: balanceOf() returns bigint directly
      const buyerBefore    = await token.balanceOf(buyer.address);
      const contractBefore = await token.balanceOf(escrow.target);

      await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);

      expect(await token.balanceOf(buyer.address)).to.equal(buyerBefore - AMOUNT);
      expect(await token.balanceOf(escrow.target)).to.equal(contractBefore + AMOUNT);
    });

    it("stores correct escrow data", async function () {
      const { escrow, buyer, seller } = await deployAll();
      const txId = makeTxId();

      await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);

      const record = await escrow.escrows(txId);
      expect(record.buyer).to.equal(buyer.address);
      expect(record.seller).to.equal(seller.address);
      expect(record.amount).to.equal(AMOUNT);
      expect(record.status).to.equal(Status.PENDING);
    });

    it("emits FundsLocked with correct args", async function () {
      const { escrow, buyer, seller } = await deployAll();
      const txId = makeTxId();

      await expect(escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT))
        .to.emit(escrow, "FundsLocked")
        .withArgs(txId, buyer.address, seller.address, AMOUNT);
    });

    it("reverts with ZeroAmount when amount is 0", async function () {
      const { escrow, buyer, seller } = await deployAll();
      await expect(
        escrow.connect(buyer).lockFunds(makeTxId(), seller.address, 0n)
      ).to.be.revertedWithCustomError(escrow, "ZeroAmount");
    });

    it("reverts with InvalidSeller when seller is zero address", async function () {
      const { escrow, buyer } = await deployAll();
      await expect(
        escrow.connect(buyer).lockFunds(makeTxId(), ZERO_ADDRESS, AMOUNT)
      ).to.be.revertedWithCustomError(escrow, "InvalidSeller");
    });

    it("reverts with TxIdAlreadyUsed on duplicate txId", async function () {
      const { escrow, buyer, seller } = await deployAll();
      const txId = makeTxId();

      await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);

      await expect(
        escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT)
      ).to.be.revertedWithCustomError(escrow, "TxIdAlreadyUsed");
    });

    it("reverts when buyer has insufficient token allowance", async function () {
      const { escrow, token, buyer, seller } = await deployAll();

      // Revoke the pre-approval set in deployAll
      await token.connect(buyer).approve(escrow.target, 0n);

      await expect(
        escrow.connect(buyer).lockFunds(makeTxId(), seller.address, AMOUNT)
      ).to.be.reverted;
    });

    it("allows any address (not just owner) to call lockFunds", async function () {
      const { escrow, token, other, seller } = await deployAll();

      await token.mint(other.address, INITIAL_SUPPLY);
      await token.connect(other).approve(escrow.target, MAX_UINT256);

      await expect(
        escrow.connect(other).lockFunds(makeTxId(), seller.address, AMOUNT)
      ).to.not.be.reverted;
    });
  });

  // ── 3. releaseFunds ────────────────────────────────────────────────────────

  describe("releaseFunds", function () {
    async function setup() {
      const base = await deployAll();
      const txId = makeTxId();
      await base.escrow.connect(base.buyer).lockFunds(txId, base.seller.address, AMOUNT);
      return { ...base, txId };
    }

    it("sends tokens to the seller", async function () {
      const { escrow, token, owner, seller, txId } = await setup();

      const sellerBefore   = await token.balanceOf(seller.address);
      const contractBefore = await token.balanceOf(escrow.target);

      await escrow.connect(owner).releaseFunds(txId);

      expect(await token.balanceOf(seller.address)).to.equal(sellerBefore + AMOUNT);
      expect(await token.balanceOf(escrow.target)).to.equal(contractBefore - AMOUNT);
    });

    it("sets status to RELEASED", async function () {
      const { escrow, owner, txId } = await setup();

      await escrow.connect(owner).releaseFunds(txId);

      expect(await escrow.getStatus(txId)).to.equal(Status.RELEASED);
    });

    it("emits FundsReleased with correct args", async function () {
      const { escrow, owner, seller, txId } = await setup();

      await expect(escrow.connect(owner).releaseFunds(txId))
        .to.emit(escrow, "FundsReleased")
        .withArgs(txId, seller.address, AMOUNT);
    });

    it("reverts when called by a non-owner", async function () {
      const { escrow, other, txId } = await setup();

      await expect(escrow.connect(other).releaseFunds(txId))
        .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });

    it("reverts with EscrowNotFound for an unknown txId", async function () {
      const { escrow, owner } = await setup();

      await expect(escrow.connect(owner).releaseFunds(makeTxId()))
        .to.be.revertedWithCustomError(escrow, "EscrowNotFound");
    });

    it("reverts with NotPending after already released (double-spend guard)", async function () {
      const { escrow, owner, txId } = await setup();

      await escrow.connect(owner).releaseFunds(txId);

      await expect(escrow.connect(owner).releaseFunds(txId))
        .to.be.revertedWithCustomError(escrow, "NotPending");
    });

    it("reverts with NotPending on a txId that was already refunded", async function () {
      const { escrow, owner, txId } = await setup();

      await escrow.connect(owner).refundFunds(txId);

      await expect(escrow.connect(owner).releaseFunds(txId))
        .to.be.revertedWithCustomError(escrow, "NotPending");
    });
  });

  // ── 4. refundFunds ─────────────────────────────────────────────────────────

  describe("refundFunds", function () {
    async function setup() {
      const base = await deployAll();
      const txId = makeTxId();
      await base.escrow.connect(base.buyer).lockFunds(txId, base.seller.address, AMOUNT);
      return { ...base, txId };
    }

    it("returns tokens to the buyer", async function () {
      const { escrow, token, owner, buyer, txId } = await setup();

      const buyerBefore    = await token.balanceOf(buyer.address);
      const contractBefore = await token.balanceOf(escrow.target);

      await escrow.connect(owner).refundFunds(txId);

      expect(await token.balanceOf(buyer.address)).to.equal(buyerBefore + AMOUNT);
      expect(await token.balanceOf(escrow.target)).to.equal(contractBefore - AMOUNT);
    });

    it("sets status to REFUNDED", async function () {
      const { escrow, owner, txId } = await setup();

      await escrow.connect(owner).refundFunds(txId);

      expect(await escrow.getStatus(txId)).to.equal(Status.REFUNDED);
    });

    it("emits FundsRefunded with correct args", async function () {
      const { escrow, owner, buyer, txId } = await setup();

      await expect(escrow.connect(owner).refundFunds(txId))
        .to.emit(escrow, "FundsRefunded")
        .withArgs(txId, buyer.address, AMOUNT);
    });

    it("reverts when called by a non-owner", async function () {
      const { escrow, other, txId } = await setup();

      await expect(escrow.connect(other).refundFunds(txId))
        .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });

    it("reverts with EscrowNotFound for an unknown txId", async function () {
      const { escrow, owner } = await setup();

      await expect(escrow.connect(owner).refundFunds(makeTxId()))
        .to.be.revertedWithCustomError(escrow, "EscrowNotFound");
    });

    it("reverts with NotPending after already refunded (double-spend guard)", async function () {
      const { escrow, owner, txId } = await setup();

      await escrow.connect(owner).refundFunds(txId);

      await expect(escrow.connect(owner).refundFunds(txId))
        .to.be.revertedWithCustomError(escrow, "NotPending");
    });

    it("reverts with NotPending on a txId that was already released", async function () {
      const { escrow, owner, txId } = await setup();

      await escrow.connect(owner).releaseFunds(txId);

      await expect(escrow.connect(owner).refundFunds(txId))
        .to.be.revertedWithCustomError(escrow, "NotPending");
    });
  });

  // ── 5. getStatus ───────────────────────────────────────────────────────────

  describe("getStatus", function () {
    it("returns PENDING (0) immediately after lockFunds", async function () {
      const { escrow, buyer, seller } = await deployAll();
      const txId = makeTxId();
      await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);
      expect(await escrow.getStatus(txId)).to.equal(Status.PENDING);
    });

    it("returns RELEASED (1) after releaseFunds", async function () {
      const { escrow, buyer, seller, owner } = await deployAll();
      const txId = makeTxId();
      await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);
      await escrow.connect(owner).releaseFunds(txId);
      expect(await escrow.getStatus(txId)).to.equal(Status.RELEASED);
    });

    it("returns REFUNDED (2) after refundFunds", async function () {
      const { escrow, buyer, seller, owner } = await deployAll();
      const txId = makeTxId();
      await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);
      await escrow.connect(owner).refundFunds(txId);
      expect(await escrow.getStatus(txId)).to.equal(Status.REFUNDED);
    });

    it("returns PENDING (0) for an unknown txId (mapping default)", async function () {
      const { escrow } = await deployAll();
      expect(await escrow.getStatus(makeTxId())).to.equal(Status.PENDING);
    });
  });

  // ── 6. Integration — full lifecycle ────────────────────────────────────────

  describe("Integration — full escrow lifecycle", function () {
    it("happy path: lock → release (Referee: PASS), correct balances end-to-end", async function () {
      const { escrow, token, owner, buyer, seller } = await deployAll();
      const txId = makeTxId();

      // ethers v6: balanceOf() already returns bigint
      const buyerStart  = await token.balanceOf(buyer.address);
      const sellerStart = await token.balanceOf(seller.address);

      // Step 1: buyer locks funds
      await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);
      expect(await token.balanceOf(buyer.address)).to.equal(buyerStart - AMOUNT);
      expect(await token.balanceOf(escrow.target)).to.equal(AMOUNT);

      // Step 2: gateway releases after PASS verdict
      await escrow.connect(owner).releaseFunds(txId);
      expect(await token.balanceOf(seller.address)).to.equal(sellerStart + AMOUNT);
      expect(await token.balanceOf(escrow.target)).to.equal(0n);

      expect(await escrow.getStatus(txId)).to.equal(Status.RELEASED);
    });

    it("failure path: lock → refund (Referee: FAIL), buyer gets full refund", async function () {
      const { escrow, token, owner, buyer, seller } = await deployAll();
      const txId = makeTxId();

      const buyerStart = await token.balanceOf(buyer.address);

      // Step 1: buyer locks funds
      await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);
      expect(await token.balanceOf(buyer.address)).to.equal(buyerStart - AMOUNT);

      // Step 2: gateway refunds after FAIL verdict
      await escrow.connect(owner).refundFunds(txId);
      expect(await token.balanceOf(buyer.address)).to.equal(buyerStart);
      expect(await token.balanceOf(escrow.target)).to.equal(0n);

      // Seller received nothing
      expect(await token.balanceOf(seller.address)).to.equal(0n);
      expect(await escrow.getStatus(txId)).to.equal(Status.REFUNDED);
    });

    it("handles multiple concurrent independent escrows correctly", async function () {
      const { escrow, token, owner, buyer, seller, other } = await deployAll();

      await token.mint(other.address, INITIAL_SUPPLY);
      await token.connect(other).approve(escrow.target, MAX_UINT256);

      const txId1 = makeTxId();
      const txId2 = makeTxId();

      await escrow.connect(buyer).lockFunds(txId1, seller.address, AMOUNT);
      await escrow.connect(other).lockFunds(txId2, seller.address, AMOUNT);

      expect(await token.balanceOf(escrow.target)).to.equal(AMOUNT * 2n);

      // txId1 → PASS, txId2 → FAIL
      await escrow.connect(owner).releaseFunds(txId1);
      await escrow.connect(owner).refundFunds(txId2);

      expect(await escrow.getStatus(txId1)).to.equal(Status.RELEASED);
      expect(await escrow.getStatus(txId2)).to.equal(Status.REFUNDED);

      // Contract fully drained
      expect(await token.balanceOf(escrow.target)).to.equal(0n);
    });

    it("contract balance stays 0 after each settlement — no funds ever stuck", async function () {
      const { escrow, token, owner, buyer, seller } = await deployAll();

      for (let i = 0; i < 3; i++) {
        const txId = makeTxId();
        await escrow.connect(buyer).lockFunds(txId, seller.address, AMOUNT);
        expect(await token.balanceOf(escrow.target)).to.equal(AMOUNT);

        if (i % 2 === 0) {
          await escrow.connect(owner).releaseFunds(txId);
        } else {
          await escrow.connect(owner).refundFunds(txId);
        }

        expect(await token.balanceOf(escrow.target)).to.equal(0n);
      }
    });
  });

});
