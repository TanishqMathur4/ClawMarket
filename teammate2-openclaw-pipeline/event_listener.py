import logging
import time
from typing import Callable

from web3 import Web3

logger = logging.getLogger(__name__)


def poll_funds_locked(
    w3: Web3,
    contract,
    handler: Callable[[dict], None],
    interval: float = 2.0,
) -> None:
    last_block = w3.eth.block_number
    logger.info("Event listener started from block %d", last_block)

    while True:
        try:
            current_block = w3.eth.block_number
            if current_block > last_block:
                events = contract.events.FundsLocked.get_logs(
                    from_block=last_block,
                    to_block=current_block,
                )
                for event in events:
                    logger.info("FundsLocked event caught: txId=%s", event.args.txId.hex())
                    handler({
                        "txId": event.args.txId,
                        "buyer": event.args.buyer,
                        "seller": event.args.seller,
                        "amount": event.args.amount,
                    })
                last_block = current_block + 1
        except Exception:
            logger.exception("Error polling FundsLocked events")

        time.sleep(interval)
