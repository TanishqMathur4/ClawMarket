from pipeline import run_pipeline


def run(inputs: dict = {}) -> dict:
    """OpenClaw skill entrypoint. Blocks indefinitely — run as a long-lived skill."""
    run_pipeline()
    return {"status": "pipeline exited"}


def main():
    run_pipeline()


if __name__ == "__main__":
    main()
