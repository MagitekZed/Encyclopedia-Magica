"""config.py — engine tunables (all overridable by the UI Settings later)."""

from __future__ import annotations

REROLL_CAP = 3                       # max COMBINED rerolls beyond the base item
MAX_POWERS_SOFT = 20                 # soft cap; above this, warn but allow
MASTER_TRUST_PRINTED_RANGE = False   # vestigial: master is fixed at source, tiles 1-100
POWER_RANDOM_POOL = None             # None = all power tables; UI may narrow this
