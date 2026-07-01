#!/bin/bash
# macOS double-click launcher.
# Picks a Python whose Tk is modern enough to render on macOS (>= 8.6).
# The system /usr/bin/python3 ships Tk 8.5, which draws BLANK windows on
# modern macOS — this script skips it in favour of a Homebrew/python.org build.
cd "$(dirname "$0")" || exit 1

pick_python() {
  for py in \
      /opt/homebrew/bin/python3.14 /opt/homebrew/bin/python3.13 /opt/homebrew/bin/python3.12 \
      /usr/local/bin/python3.14 /usr/local/bin/python3.13 /usr/local/bin/python3.12 \
      python3.14 python3.13 python3.12 python3; do
    command -v "$py" >/dev/null 2>&1 || continue
    if "$py" -c 'import sys,tkinter; sys.exit(0 if tkinter.TkVersion>=8.6 else 1)' 2>/dev/null; then
      printf '%s' "$py"; return 0
    fi
  done
  return 1
}

PY="$(pick_python)"
if [ -z "$PY" ]; then
  echo "No Python with a modern Tk (>= 8.6) was found."
  echo "The system python3 uses Tk 8.5, which renders blank windows on macOS."
  echo "Install a good one with:   brew install python-tk"
  exit 1
fi
echo "Launching with: $PY  ($("$PY" -c 'import tkinter;print("Tk",tkinter.TkVersion)'))"
exec "$PY" roller.py "$@"
