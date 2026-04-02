"""
backup_router.py — Google Drive backup management API for admin dashboard.

Endpoints:
  POST   /api/admin/backup/run           Trigger pg_dump + upload to Drive
  GET    /api/admin/backup/list          List backups on Drive
  POST   /api/admin/backup/restore       Download + restore a backup
  DELETE /api/admin/backup/{filename}    Delete a backup from Drive
"""

import asyncio
import gzip
import os
import re
import shutil
import subprocess
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin/backup", tags=["backup"])

RCLONE_REMOTE = os.getenv("RCLONE_REMOTE", "hongyigoogledrive")
GDRIVE_FOLDER = os.getenv("GDRIVE_FOLDER", "searchengine_db")
TMP_DIR = "/tmp/verdant_backups"

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_USER = os.getenv("POSTGRES_USER", "verdant")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "verdant")
POSTGRES_DB = os.getenv("POSTGRES_DB", "verdant_search")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _human_size(size_bytes: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def _now() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _find_docker_container() -> Optional[str]:
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True, text=True, timeout=5,
        )
        for name in result.stdout.strip().split("\n"):
            if re.search(
                r"(verdant.*postgres|postgres.*verdant|^verdant_db|^verdant-db|^postgres)",
                name,
            ):
                return name.strip()
    except Exception:
        pass
    return None


# ── Backup ─────────────────────────────────────────────────────────────────────

@router.post("/run")
async def run_backup():
    """Trigger a pg_dump and upload the compressed file to Google Drive."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"verdant_db_{timestamp}.sql.gz"
    local_path = os.path.join(TMP_DIR, filename)
    logs: list[str] = []
    os.makedirs(TMP_DIR, exist_ok=True)

    try:
        # ── pg_dump ────────────────────────────────────────────────────────
        logs.append(f"[{_now()}] Starting pg_dump…")
        container = _find_docker_container()

        if container:
            logs.append(f"[{_now()}] Docker container detected: {container}")
            proc = await asyncio.create_subprocess_exec(
                "docker", "exec", container,
                "pg_dump", "-U", POSTGRES_USER, POSTGRES_DB,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        else:
            logs.append(f"[{_now()}] Direct pg_dump ({POSTGRES_HOST}:{POSTGRES_PORT})")
            env = {**os.environ, "PGPASSWORD": POSTGRES_PASSWORD}
            proc = await asyncio.create_subprocess_exec(
                "pg_dump", "-h", POSTGRES_HOST, "-p", POSTGRES_PORT,
                "-U", POSTGRES_USER, POSTGRES_DB,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

        dump_data, dump_err = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"pg_dump failed: {dump_err.decode()[:300]}")

        # ── gzip ──────────────────────────────────────────────────────────
        with gzip.open(local_path, "wb") as f:
            f.write(dump_data)

        size = os.path.getsize(local_path)
        logs.append(f"[{_now()}] Compressed backup: {_human_size(size)}")

        # ── rclone upload ─────────────────────────────────────────────────
        logs.append(f"[{_now()}] Uploading to {RCLONE_REMOTE}:{GDRIVE_FOLDER}/…")
        rclone_proc = await asyncio.create_subprocess_exec(
            "rclone", "copy", local_path,
            f"{RCLONE_REMOTE}:{GDRIVE_FOLDER}/",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, rclone_err = await rclone_proc.communicate()
        if rclone_proc.returncode != 0:
            raise RuntimeError(f"rclone upload failed: {rclone_err.decode()[:300]}")

        os.remove(local_path)
        logs.append(f"[{_now()}] Upload complete → {RCLONE_REMOTE}:{GDRIVE_FOLDER}/{filename}")
        logs.append(f"[{_now()}] Done ✓")

        return {"success": True, "filename": filename, "size_human": _human_size(size), "logs": logs}

    except Exception as exc:
        logs.append(f"[{_now()}] ERROR: {exc}")
        if os.path.exists(local_path):
            os.remove(local_path)
        return {"success": False, "logs": logs, "error": str(exc)}


# ── List ────────────────────────────────────────────────────────────────────────

@router.get("/list")
async def list_backups():
    """Return all backup files stored on Google Drive."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "rclone", "ls", f"{RCLONE_REMOTE}:{GDRIVE_FOLDER}/",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()

        backups = []
        for line in stdout.decode().strip().split("\n"):
            if not line.strip() or "verdant_db_" not in line:
                continue
            parts = line.strip().split(None, 1)
            if len(parts) != 2:
                continue
            size_str, fname = parts
            try:
                size_bytes = int(size_str)
            except ValueError:
                continue

            created_at = None
            m = re.search(r"verdant_db_(\d{8})_(\d{6})", fname)
            if m:
                try:
                    created_at = datetime.strptime(
                        m.group(1) + m.group(2), "%Y%m%d%H%M%S"
                    ).isoformat()
                except ValueError:
                    pass

            backups.append({
                "filename": fname.strip(),
                "size_bytes": size_bytes,
                "size_human": _human_size(size_bytes),
                "created_at": created_at,
            })

        backups.sort(key=lambda x: x["filename"], reverse=True)
        return {"backups": backups, "total": len(backups)}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Restore ─────────────────────────────────────────────────────────────────────

class RestoreRequest(BaseModel):
    filename: str
    confirm: bool = False


@router.post("/restore")
async def restore_backup(req: RestoreRequest):
    """Download a backup from Google Drive and restore it into PostgreSQL."""
    if not req.confirm:
        raise HTTPException(
            status_code=400,
            detail="Set confirm=true to confirm destructive restore operation.",
        )

    local_gz = os.path.join(TMP_DIR, req.filename)
    local_sql = local_gz.removesuffix(".gz")
    logs: list[str] = []
    os.makedirs(TMP_DIR, exist_ok=True)

    try:
        # ── Download ──────────────────────────────────────────────────────
        logs.append(f"[{_now()}] Downloading {req.filename}…")
        dl = await asyncio.create_subprocess_exec(
            "rclone", "copy",
            f"{RCLONE_REMOTE}:{GDRIVE_FOLDER}/{req.filename}",
            TMP_DIR + "/",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, dl_err = await dl.communicate()
        if dl.returncode != 0:
            raise RuntimeError(f"rclone download failed: {dl_err.decode()[:300]}")
        logs.append(f"[{_now()}] Download complete.")

        # ── Decompress ────────────────────────────────────────────────────
        logs.append(f"[{_now()}] Decompressing…")
        with gzip.open(local_gz, "rb") as f_in, open(local_sql, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
        os.remove(local_gz)
        logs.append(f"[{_now()}] Decompressed: {_human_size(os.path.getsize(local_sql))}")

        # ── Restore ───────────────────────────────────────────────────────
        logs.append(f"[{_now()}] Restoring into database '{POSTGRES_DB}'…")
        container = _find_docker_container()

        if container:
            # Copy SQL file into container, then run psql
            subprocess.run(
                ["docker", "cp", local_sql, f"{container}:/tmp/verdant_restore.sql"],
                check=True, timeout=30,
            )
            res = subprocess.run(
                ["docker", "exec", container,
                 "psql", "-U", POSTGRES_USER, "-d", POSTGRES_DB,
                 "-f", "/tmp/verdant_restore.sql"],
                capture_output=True, text=True, timeout=300,
            )
        else:
            env = {**os.environ, "PGPASSWORD": POSTGRES_PASSWORD}
            with open(local_sql, "rb") as sql_file:
                res = subprocess.run(
                    ["psql", "-h", POSTGRES_HOST, "-p", POSTGRES_PORT,
                     "-U", POSTGRES_USER, "-d", POSTGRES_DB],
                    stdin=sql_file, capture_output=True, text=True,
                    timeout=300, env=env,
                )

        if res.returncode != 0:
            logs.append(f"[{_now()}] psql stderr: {res.stderr[:300]}")
            raise RuntimeError("psql restore returned non-zero exit code")

        logs.append(f"[{_now()}] Restore complete ✓")
        return {"success": True, "logs": logs}

    except Exception as exc:
        logs.append(f"[{_now()}] ERROR: {exc}")
        return {"success": False, "logs": logs, "error": str(exc)}
    finally:
        for f in [local_gz, local_sql]:
            if os.path.exists(f):
                os.remove(f)


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete("/{filename}")
async def delete_backup(filename: str):
    """Permanently delete a backup file from Google Drive."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "rclone", "delete",
            f"{RCLONE_REMOTE}:{GDRIVE_FOLDER}/{filename}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, err = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(err.decode()[:300])
        return {"success": True, "deleted": filename}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
