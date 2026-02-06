#!/usr/bin/env python3
"""Export marimo notebooks to static HTML without code cells."""

import subprocess
import sys
from pathlib import Path


NOTEBOOKS = [
    "algorithm_docs.py",
    "engine_analysis.py",
]


def main():
    """Export notebooks to HTML with --no-include-code flag."""
    script_dir = Path(__file__).parent
    html_dir = script_dir / "html"
    html_dir.mkdir(exist_ok=True)

    print("Exporting marimo notebooks to HTML (without code)...\n")

    for notebook in NOTEBOOKS:
        notebook_path = script_dir / notebook
        output_path = html_dir / notebook.replace(".py", ".html")

        if not notebook_path.exists():
            print(f"  ⚠ Skipping {notebook} (not found)")
            continue

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
            print(f"    {result.stderr}")
            sys.exit(1)

        print(f"  ✓ Exported to {output_path.name}")

    print(f"\n✓ All notebooks exported to {html_dir}/")
    print("\nNext step: run 'npm run prerender-notebooks' from the project root.")


if __name__ == "__main__":
    main()
