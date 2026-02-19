#!/usr/bin/env python3
"""
Multi-notebook marimo server with hot reload.
"""

import marimo

server = (
    marimo.create_asgi_app()
    .with_app(path="/algorithm_docs", root="./algorithm_docs.py")
    .with_app(path="/engine_analysis", root="./engine_analysis.py")
    .build()
)

if __name__ == "__main__":
    import uvicorn

    print("\n📓 Marimo Multi-Notebook Server")
    print("=" * 40)
    print("Available notebooks:")
    print("  • http://localhost:8765/algorithm_docs")
    print("  • http://localhost:8765/engine_analysis")
    print("=" * 40)
    print("Watching for file changes...\n")

    uvicorn.run(
        "serve:server",
        host="localhost",
        port=8765,
        reload=True,
        reload_includes=["serve.py"],  # Only restart server when serve.py changes
    )
