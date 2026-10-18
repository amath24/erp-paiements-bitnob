"""Ancien nom conservé : fait exactement la même chose que scripts/migrate.py."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name("migrate.py")), run_name="__main__")
