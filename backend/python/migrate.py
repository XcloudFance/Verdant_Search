#!/usr/bin/env python3
"""
Verdant Search — Database Migration Runner

Runs all pending SQL migrations from the /migrations directory in order.
Each migration is recorded in the schema_migrations table and never run twice.
Safe to call on every startup — already-applied migrations are skipped.

Usage:
    python migrate.py
    python migrate.py --dry-run   (show pending migrations without applying)
"""

import os
import sys
import argparse
from pathlib import Path
from urllib.parse import urlparse

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


def get_dsn() -> dict:
    """Parse DB connection from DATABASE_URL env or use defaults."""
    url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://verdant:verdant123@localhost:5432/verdant_search"
    )
    # Strip SQLAlchemy driver prefix
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    url = url.replace("postgresql+psycopg2://", "postgresql://")

    parsed = urlparse(url)
    return {
        "dbname":   parsed.path.lstrip("/"),
        "user":     parsed.username,
        "password": parsed.password or "",
        "host":     parsed.hostname or "localhost",
        "port":     parsed.port or 5432,
    }


def connect(dsn: dict, retries: int = 10):
    """Connect to PostgreSQL, retrying if not ready yet."""
    import time
    for attempt in range(1, retries + 1):
        try:
            conn = psycopg2.connect(**dsn)
            return conn
        except psycopg2.OperationalError as e:
            if attempt == retries:
                print(f"\nERROR: Could not connect to PostgreSQL after {retries} attempts.")
                print(f"  {e}")
                sys.exit(1)
            print(f"  Waiting for PostgreSQL... (attempt {attempt}/{retries})")
            time.sleep(2)


def run_migrations(dry_run: bool = False):
    print("=" * 50)
    print("  Verdant Search — Database Migrations")
    print("=" * 50)

    dsn = get_dsn()
    conn = connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    # Ensure tracking table exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     VARCHAR(255) PRIMARY KEY,
            applied_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    conn.commit()

    # Get already-applied versions
    cur.execute("SELECT version FROM schema_migrations ORDER BY version")
    applied = {row[0] for row in cur.fetchall()}

    # Resolve migrations directory (two levels up from backend/python/)
    migrations_dir = Path(__file__).resolve().parent.parent.parent / "migrations"
    if not migrations_dir.exists():
        print(f"  No migrations directory found at {migrations_dir}")
        cur.close()
        conn.close()
        return

    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        print("  No migration files found.")
        cur.close()
        conn.close()
        return

    pending = [f for f in migration_files if f.stem not in applied]

    if not pending:
        print("  ✓ Schema is up to date — no migrations to apply.")
        for f in migration_files:
            print(f"    ✓ {f.stem}")
        cur.close()
        conn.close()
        return

    # Show already-applied
    for f in migration_files:
        if f.stem in applied:
            print(f"  ✓ {f.stem}  (already applied)")

    if dry_run:
        print("\n  Pending migrations (dry-run, not applied):")
        for f in pending:
            print(f"    → {f.stem}")
        cur.close()
        conn.close()
        return

    # Apply pending migrations
    applied_count = 0
    for f in pending:
        version = f.stem
        print(f"  → Applying {version} ...", end="", flush=True)
        sql = f.read_text(encoding="utf-8")
        try:
            cur.execute(sql)
            cur.execute(
                "INSERT INTO schema_migrations (version) VALUES (%s)",
                (version,)
            )
            conn.commit()
            applied_count += 1
            print(" ✓")
        except Exception as e:
            conn.rollback()
            print(f" FAILED\n\nERROR in {version}:\n  {e}")
            cur.close()
            conn.close()
            sys.exit(1)

    cur.close()
    conn.close()

    print(f"\n  ✓ Applied {applied_count} migration(s) successfully.")
    print("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verdant Search migration runner")
    parser.add_argument("--dry-run", action="store_true", help="Show pending migrations without applying")
    args = parser.parse_args()
    run_migrations(dry_run=args.dry_run)
