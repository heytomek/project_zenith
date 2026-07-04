import os
import subprocess
import sys
from pathlib import Path


def test_alembic_upgrade_creates_foundation_tables(tmp_path: Path) -> None:
    database_path = tmp_path / "zenith_test.sqlite3"
    env = os.environ.copy()
    env["ZENITH_DATABASE_URL"] = f"sqlite:///{database_path}"
    env["PYTHONPATH"] = "packages/schemas/src:services/planner/src"

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            "apps/api/alembic.ini",
            "upgrade",
            "head",
        ],
        cwd=Path(__file__).resolve().parents[2],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    assert database_path.exists()
