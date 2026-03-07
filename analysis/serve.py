#!/usr/bin/env python3
"""
Multi-notebook marimo server with hot reload.
"""

import marimo

_NOTEBOOKS = [
    ("/algorithm_docs", "Algorithm Docs"),
    ("/engine_analysis", "Engine Analysis"),
    ("/smart_matching_analysis", "Smart Matching Analysis"),
    ("/level_tracker_analysis", "Level Tracker Analysis"),
]

_INDEX_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Marimo Notebooks</title>
  <style>
    body {{ font-family: sans-serif; max-width: 480px; margin: 60px auto; color: #222; }}
    h1 {{ font-size: 1.4rem; margin-bottom: 1.5rem; }}
    ul {{ list-style: none; padding: 0; }}
    li {{ margin: 0.6rem 0; }}
    a {{ text-decoration: none; color: #2563eb; font-size: 1rem; }}
    a:hover {{ text-decoration: underline; }}
    .path {{ color: #888; font-size: 0.85rem; margin-left: 0.4rem; }}
  </style>
</head>
<body>
  <h1>📓 Marimo Notebooks</h1>
  <ul>
{items}
  </ul>
</body>
</html>
""".format(
    items="\n".join(
        f'    <li><a href="{path}">{label}</a><span class="path">{path}</span></li>'
        for path, label in _NOTEBOOKS
    )
)

_marimo_app = (
    marimo.create_asgi_app()
    .with_app(path="/algorithm_docs", root="./algorithm_docs.py")
    .with_app(path="/engine_analysis", root="./engine_analysis.py")
    .with_app(path="/smart_matching_analysis", root="./smart_matching_analysis.py")
    .with_app(path="/level_tracker_analysis", root="./level_tracker_analysis.py")
    .build()
)


async def server(scope, receive, send):
    if scope["type"] == "http" and scope["path"] in ("/", ""):
        body = _INDEX_HTML.encode()
        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [
                (b"content-type", b"text/html; charset=utf-8"),
                (b"content-length", str(len(body)).encode()),
            ],
        })
        await send({"type": "http.response.body", "body": body})
    else:
        await _marimo_app(scope, receive, send)


if __name__ == "__main__":
    import uvicorn

    print("\n📓 Marimo Multi-Notebook Server")
    print("=" * 40)
    print("Available notebooks:")
    for path, label in _NOTEBOOKS:
        print(f"  • http://localhost:8765{path}")
    print("=" * 40)
    print("Watching for file changes...\n")

    uvicorn.run(
        "serve:server",
        host="localhost",
        port=8765,
        reload=True,
        reload_includes=["serve.py"],  # Only restart server when serve.py changes
    )
