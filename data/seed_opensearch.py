#!/usr/bin/env python3
"""
Convenience script to run the OpenSearch seed pipeline.
Usage from project root:
  cd server && uv run python -m server.data.seed
"""
import sys
from pathlib import Path

# Add server/src to sys.path
server_src = Path(__file__).resolve().parent.parent / "server" / "src"
sys.path.insert(0, str(server_src))

from server.data.seed import main

if __name__ == "__main__":
    main()
