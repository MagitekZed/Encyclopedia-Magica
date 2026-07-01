#!/usr/bin/env python3
"""Encyclopedia Magica Roller — entry point.

Usage:
    python roller.py            # launch the Tkinter app
    python roller.py --verify   # run the data self-test and print a report
    python roller.py --seed N   # launch with a locked starting seed

Stdlib only; runs on stock CPython 3.9+ with no pip install.
"""

from __future__ import annotations

import sys
from pathlib import Path


def resource_path(rel: str) -> Path:
    """Resolve a bundled resource, whether running from source or PyInstaller.

    Running from source, the shared dataset lives at the repo root (one level
    above this ``desktop/`` folder); PyInstaller bundles it alongside the exe.
    """
    base = getattr(sys, "_MEIPASS", None)          # set by PyInstaller at runtime
    if base:
        return Path(base) / rel
    return Path(__file__).resolve().parent.parent / rel   # repo-root/<rel>, from desktop/


def app_dir() -> Path:
    return resource_path("app")


def run_verify() -> int:
    from enc_roller.diagnostics import run_self_test
    report, ok = run_self_test(app_dir())
    print(report)
    return 0 if ok else 1


def _parse_seed(argv) -> int | None:
    if "--seed" in argv:
        i = argv.index("--seed")
        try:
            return int(argv[i + 1])
        except (IndexError, ValueError):
            print("--seed requires an integer argument", file=sys.stderr)
            raise SystemExit(2)
    return None


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--verify" in argv:
        return run_verify()
    if "-h" in argv or "--help" in argv:
        print(__doc__)
        return 0
    seed = _parse_seed(argv)
    from enc_roller.ui.app import launch
    launch(app_dir(), seed=seed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
