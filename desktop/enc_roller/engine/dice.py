"""dice.py — the determinism seam.

The engine takes a ``Roller`` so seeding, replay, and scripted tests all work
without touching engine logic.  A locked seed means "the RNG is a
``random.Random(seed)`` *sequence*; each roll advances it" — reproducible, not
frozen.  Replay = a fresh ``DefaultRoller(seed)`` re-run from the start.
"""

from __future__ import annotations

import random
from typing import Protocol, runtime_checkable


@runtime_checkable
class Roller(Protocol):
    def roll(self, die: int) -> int:            # returns 1..die inclusive
        ...

    @property
    def seed(self) -> int | None:
        ...


class DefaultRoller:
    """Seeded ``random.Random`` sequence.  ``seed=None`` picks a fresh seed."""

    def __init__(self, seed: int | None = None):
        self._seed = seed if seed is not None else random.randrange(2 ** 31)
        self._r = random.Random(self._seed)

    def roll(self, die: int) -> int:
        return self._r.randint(1, die)

    @property
    def seed(self) -> int | None:
        return self._seed


class FixedRoller:
    """Scripted queue of results, for tests.  ``seed`` is always None."""

    def __init__(self, values):
        self._q = list(values)
        self._seed = None

    def roll(self, die: int) -> int:
        if not self._q:
            raise IndexError("FixedRoller exhausted: script more rolls")
        return self._q.pop(0)

    @property
    def seed(self) -> int | None:
        return None
