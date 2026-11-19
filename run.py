#!/usr/bin/env python3
"""
Higher Studies Tracking System (HSTS)
Single-command launcher: starts backend and frontend, and opens the browser.

Run command:
    python3 run.py
    (or: py run.py)
"""
import argparse
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

# Automatically add 'src' to Python module path
ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

# Import HSTS modules (supports both root-level and src-level imports)
try:
    from hsts.api import serve
    from hsts.db import Repository
    from hsts.seed import seed
except (ImportError, ModuleNotFoundError):
    from src.hsts.api import serve
    from src.hsts.db import Repository
    from src.hsts.seed import seed

def ensure_database(db_file):
    """Ensures database directory exists and seeds demo data if not present."""
    db_path = Path(db_file)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if not db_path.exists() or db_path.stat().st_size == 0:
        print(f"[*] Initializing and seeding database at: {db_path}")
        seed(str(db_path))
        print("[+] Database seeded with demo records successfully.")

def open_browser_when_ready(url, delay=0.6):
    """Opens browser automatically in a background thread once server starts."""
    time.sleep(delay)
    try:
        webbrowser.open(url)
    except Exception:
        pass

def main():
    parser = argparse.ArgumentParser(description="Higher Studies Tracking System (HSTS) Launcher")
    parser.add_argument("--open", action="store_true", default=True, help="Automatically open browser (default: True)")
    parser.add_argument("--no-open", dest="open", action="store_false", help="Do not open browser")
    parser.add_argument("--host", default=os.environ.get("HSTS_HOST", "127.0.0.1"), help="Server host")
    parser.add_argument("--port", type=int, default=int(os.environ.get("HSTS_PORT", "8080")), help="Server port (default: 8080)")
    parser.add_argument("--db", default=os.environ.get("HSTS_DB", str(ROOT_DIR / "hsts-demo.sqlite3")), help="Database file path")
    args, _ = parser.parse_known_args()

    host = args.host
    port = args.port
    db_file = args.db

    # 1. Setup Database
    ensure_database(db_file)

    url = f"http://{host}:{port}"

    # 2. Print status banner and credentials
    print("=" * 65)
    print(" Higher Studies Tracking System (HSTS)")
    print(" Backend & Frontend are running together at:")
    print(f"  --> {url}")
    print("=" * 65)
    print(" Demo Accounts (LNMIIT):")
    print("   Laxita Bhimsaria: 24ucs144@lnmiit.ac.in | pass: Laxita123!")
    print("   Vaibhav Goyal:    24ucs145@lnmiit.ac.in | pass: Vaibhav12!")
    print("   Manan Jain:       24ucs146@lnmiit.ac.in | pass: Manan1234!")
    print("   Harsh Varshney:   24ucs148@lnmiit.ac.in | pass: Harsh1234!")
    print("=" * 65)
    print(" Press Ctrl + C to stop the server.\n")

    # 3. Automatically launch browser
    if args.open:
        threading.Thread(target=open_browser_when_ready, args=(url,), daemon=True).start()

    # 4. Start HTTP Server (serves both API & Frontend)
    serve(database=db_file, host=host, port=port)

if __name__ == "__main__":
    main()
