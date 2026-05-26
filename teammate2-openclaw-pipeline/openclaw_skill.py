import pipeline


def run(inputs: dict) -> dict:
    """OpenClaw skill entrypoint. Blocks indefinitely — run as a long-lived skill."""
    pipeline.run_pipeline()
    return {"status": "pipeline exited"}
