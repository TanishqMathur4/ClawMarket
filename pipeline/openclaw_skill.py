# pipeline/openclaw_skill.py
# ── T2: OpenClaw Skill Entrypoint ─────────────────────────────────────────
# Wraps run_pipeline() as an OpenClaw skill so it can be invoked,
# paused, and logged within the OpenClaw environment.

from pipeline import run_pipeline

def main():
    run_pipeline()

if __name__ == "__main__":
    main()
