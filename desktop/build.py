#!/usr/bin/env python3
"""Optional: build a standalone binary with PyInstaller (packaging tier 3).

Usage:
    pip install pyinstaller
    python build.py            # --onedir (fast cold start, simple data bundling)
    python build.py --onefile  # single portable exe (slower launch, temp unpack)

The `--add-data` separator is OS-specific (``os.pathsep``): "app:app" on
macOS/Linux, "app;app" on Windows.  Tier 1 (`python roller.py`) and tier 2
(the run.command / run.bat launchers) avoid all binary-signing friction and
are the recommended paths; this is here only for a distributable build.

macOS note: an unsigned .app triggers Gatekeeper ("developer cannot be
verified").  Right-click → Open once, or run:
    xattr -dr com.apple.quarantine dist/EncMagicaRoller.app
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent        # desktop/
ROOT = HERE.parent                            # repo root (shared dataset lives at ROOT/app)


def main() -> int:
    onefile = "--onefile" in sys.argv
    add_data = f"{ROOT / 'app'}{os.pathsep}app"       # bundle the shared dataset as "app/"
    cmd = [
        sys.executable, "-m", "PyInstaller", "--noconfirm", "--windowed",
        "--name", "EncMagicaRoller",
        "--onefile" if onefile else "--onedir",
        "--add-data", add_data,
        str(HERE / "roller.py"),
    ]
    print("running:", " ".join(cmd))
    try:
        return subprocess.call(cmd)
    except FileNotFoundError:
        print("PyInstaller not found — install it with:  pip install pyinstaller",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
