#!/usr/bin/env python3
"""
Multi-notebook marimo server with hot reload.

Run with: python serve.py
Or:       uv run serve.py

Access notebooks at:
  - http://localhost:8765/           (index)
  - http://localhost:8765/analysis
  - http://localhost:8765/algorithm_docs
  - http://localhost:8765/bench_analysis
"""

import marimo

server = (
    marimo.create_asgi_app()
    .with_app(path="/analysis", root="./analysis.py")
    .with_app(path="/algorithm_docs", root="./algorithm_docs.py")
    .with_app(path="/bench_analysis", root="./bench_analysis.py")
    .build()
)

if __name__ == "__main__":
    import uvicorn

    print("\n📓 Marimo Multi-Notebook Server")
    print("=" * 40)
    print("Available notebooks:")
    print("  • http://localhost:8765/analysis")
    print("  • http://localhost:8765/algorithm_docs")
    print("  • http://localhost:8765/bench_analysis")
    print("=" * 40)
    print("Watching for file changes...\n")

    uvicorn.run(
        "serve:server",
        host="localhost",
        port=8765,
        reload=True,
        reload_includes=["serve.py"],  # Only restart server when serve.py changes
    )
