"""ranges.py — the ONLY roll-string decoder.

Every roll-string quirk in the dataset (``000``=1000, ``953-000``, ``91-00``,
``78-00``, bare ``1``) collapses into two tested functions here.  The die is
*always* supplied explicitly and is *never* inferred from the string — S1's
first row ``"01-97"`` looks like a d100 range but the table is d1000.
"""

from __future__ import annotations


def _token(tok: str, die: int) -> int:
    """Decode one side of a roll string against a known die.

    A token that is *all zeros* (``"0"``, ``"00"``, ``"000"``) encodes the
    die's maximum.  Any other token is its literal integer value.
    """
    tok = tok.strip()
    if not tok:
        raise ValueError("empty roll token")
    if set(tok) == {"0"}:          # "0", "00", "000" -> die max
        return die
    return int(tok)


def parse_range(s: str, die: int) -> tuple[int, int]:
    """Decode a printed roll string against a known die into ``(low, high)``.

    Rules:
      - split on ``'-'`` into ``(lo, hi)``; a bare ``'5'`` -> ``(5, 5)``.
      - a trailing ALL-ZEROS token (``'0'``, ``'00'``, ``'000'``) maps to ``die``.

    Examples (die given explicitly, NEVER inferred from the string)::

        parse_range('001-000', 1000) -> (1, 1000)
        parse_range('953-000', 1000) -> (953, 1000)
        parse_range('98-100',  1000) -> (98, 100)     # S1 row, die pinned 1000
        parse_range('91-00',   100)  -> (91, 100)
        parse_range('78-00',   100)  -> (78, 100)
        parse_range('1',       20)   -> (1, 1)
    """
    parts = str(s).strip().split("-")
    if len(parts) == 1:
        v = _token(parts[0], die)
        return (v, v)
    if len(parts) != 2:
        raise ValueError(f"cannot parse roll string {s!r}")
    return (_token(parts[0], die), _token(parts[1], die))


def contains(low: int, high: int, roll: int) -> bool:
    """True iff ``roll`` falls within the inclusive ``[low, high]`` range."""
    return low <= roll <= high
