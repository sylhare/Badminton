#!/usr/bin/env python3
"""Export marimo notebooks to static HTML without code cells."""

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


NOTEBOOKS = [
    "algorithm_docs.py",
    "engine_analysis.py",
    "level_tracker_analysis.py",
    "ui_load_analysis.py",
]


def export_notebook(notebook: str, script_dir: Path, html_dir: Path) -> str | None:
    """Export one notebook to HTML. Returns an error message, or None on success/skip."""
    notebook_path = script_dir / notebook
    output_path = html_dir / notebook.replace(".py", ".html")

    if not notebook_path.exists():
        print(f"  ⚠ Skipping {notebook} (not found)")
        return None

    print(f"  Exporting {notebook}...")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "marimo",
            "export",
            "html",
            "--no-include-code",
            str(notebook_path),
            "-o",
            str(output_path),
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"  ✗ Failed to export {notebook}")
        return f"{notebook}: {result.stderr}"

    print(f"  ✓ Exported to {output_path.name}")
    return None


def main():
    """Export notebooks to HTML with --no-include-code flag."""
    script_dir = Path(__file__).parent
    html_dir = script_dir / "html"
    html_dir.mkdir(exist_ok=True)

    print("Exporting marimo notebooks to HTML (without code)...\n")

    # The exports are independent and each blocks on a slow marimo subprocess, so
    # run them concurrently — wall time becomes the slowest export, not their sum.
    with ThreadPoolExecutor(max_workers=len(NOTEBOOKS)) as pool:
        errors = [
            error
            for error in pool.map(
                lambda notebook: export_notebook(notebook, script_dir, html_dir),
                NOTEBOOKS,
            )
            if error is not None
        ]

    if errors:
        for error in errors:
            print(f"    {error}")
        sys.exit(1)

    print(f"\n✓ All notebooks exported to {html_dir}/")
    print("\nNext step: run 'npm run prerender-notebooks' from the project root.")


if __name__ == "__main__":
    main()
