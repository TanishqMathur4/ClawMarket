import logging
from time import sleep
from typing import Callable

logger = logging.getLogger(__name__)


def start_polling(contract, on_event_callback: Callable[[dict], None], interval: int = 2) -> None:
    """Poll FundsLocked events and call on_event_callback for each new event."""
    from web3 import Web3
    w3 = contract.w3
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
                    logger.info("FundsLocked caught: txId=%s", event.args.txId.hex())
                    on_event_callback({
                        "txId":   event.args.txId,
                        "buyer":  event.args.buyer,
                        "seller": event.args.seller,
                        "amount": event.args.amount,
                    })
                last_block = current_block + 1
        except Exception:
            logger.exception("Error polling FundsLocked events")

        sleep(interval)
