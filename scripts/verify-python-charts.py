"""Run actual generated programs with a headless renderer, not syntax-only checks."""
from pathlib import Path
import runpy
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

programs = sorted(Path(".artifacts/python-charts").glob("*/neuroforge-chart.py"))
assert len(programs) >= 42, "Missing chart fixtures"
for program in programs:
    runpy.run_path(str(program), run_name="__main__")
    assert plt.get_fignums(), f"No plot generated: {program}"
    plt.savefig(program.parent / "python-chart.png")
    plt.close("all")
    print(f"Rendered {program.parent.name}")
