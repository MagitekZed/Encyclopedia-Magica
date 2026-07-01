"""Encyclopedia Magica Roller — AD&D 2e magic-item & artifact dice-roller.

Layers (strict one-way dependency: ui -> engine -> data -> stdlib):
    data/    typed models + roll-string parsing + JSON loading + indexed lookups
    engine/  the roll mechanics; pure, headless, unit-tested
    ui/      Tkinter front-end (a thin, swappable skin)
"""

__version__ = "1.0.0"
