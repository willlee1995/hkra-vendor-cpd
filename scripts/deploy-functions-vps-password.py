#!/usr/bin/env python3
"""Deploy Edge Functions over SSH with password auth.

Loads `.env.edge` from the repo root (see `.env.edge.example`).
Override with shell env vars; DEPLOY_SSH_PASSWORD is required.
"""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

REPO_ROOT = Path(__file__).resolve().parents[1]
FUNC_ROOT = REPO_ROOT / "supabase" / "functions"
ENV_EDGE = REPO_ROOT / ".env.edge"
FUNCTION_DIRS = [
    "_shared",
    "hkra-create-event",
    "zoom-create-webinar",
    "zoom-list-webinars",
    "vendor-requests",
    "vendor-upload",
    "vendor-upload-poster",
    "vendor-info",
    "vendor-reminders",
    "manage-users",
    "campaign-proxy",
]
REMOTE_DIR = os.environ.get("REMOTE_EDGE_FUNCTIONS_DIR", "/tmp/hkra-edge-functions")
DOCKER_CONTAINER = os.environ.get("DOCKER_CONTAINER", "supabase-edge-functions")
FUNCTIONS_PATH = os.environ.get("FUNCTIONS_PATH", "/home/deno/functions")


def load_env_edge() -> None:
    if not ENV_EDGE.is_file():
        return
    for raw in ENV_EDGE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        if key and key not in os.environ:
            os.environ[key] = val


def main() -> int:
    load_env_edge()
    host = os.environ.get("VPS_HOST", "46.202.166.252")
    user = os.environ.get("VPS_USER", "root")
    password = os.environ.get("DEPLOY_SSH_PASSWORD", "").strip()
    if not password:
        print("Set DEPLOY_SSH_PASSWORD for SSH authentication.", file=sys.stderr)
        return 1

    for name in FUNCTION_DIRS:
        if not (FUNC_ROOT / name).is_dir():
            print(f"Missing: supabase/functions/{name}", file=sys.stderr)
            return 1

    print(f"Deploying Edge Functions -> {user}@{host}")
    print(f"  Container: {DOCKER_CONTAINER}:{FUNCTIONS_PATH}")

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tar_path = Path(tmp.name)

    try:
        print("Packing functions...")
        with tarfile.open(tar_path, "w:gz") as tar:
            for name in FUNCTION_DIRS:
                tar.add(FUNC_ROOT / name, arcname=name)

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(host, username=user, password=password, timeout=60)

        remote_tar = f"{REMOTE_DIR}.tar.gz"
        print("Uploading tarball...")
        client.exec_command(f"rm -rf '{REMOTE_DIR}' '{remote_tar}' && mkdir -p '{REMOTE_DIR}'")
        sftp = client.open_sftp()
        sftp.put(str(tar_path), remote_tar)
        sftp.close()

        extract = f"tar xzf '{remote_tar}' -C '{REMOTE_DIR}' && rm -f '{remote_tar}'"
        _, stdout, stderr = client.exec_command(extract)
        stdout.channel.recv_exit_status()
        err = stderr.read().decode()
        if err.strip():
            print(err)

        docker_cmds = [
            f"docker exec '{DOCKER_CONTAINER}' mkdir -p '{FUNCTIONS_PATH}' 2>/dev/null || true",
        ]
        for name in FUNCTION_DIRS:
            docker_cmds.append(
                f"docker cp '{REMOTE_DIR}/{name}' '{DOCKER_CONTAINER}':'{FUNCTIONS_PATH}/'"
            )
        docker_cmds.append(f"docker restart '{DOCKER_CONTAINER}'")
        docker_cmds.append(f"rm -rf '{REMOTE_DIR}'")
        remote_cmd = " && ".join(docker_cmds)

        print("docker cp + restart...")
        _, stdout, stderr = client.exec_command(remote_cmd, timeout=120)
        code = stdout.channel.recv_exit_status()
        out = stdout.read().decode()
        err = stderr.read().decode()
        if out.strip():
            print(out.strip())
        if err.strip():
            print(err.strip(), file=sys.stderr)
        client.close()

        if code != 0:
            print(f"Remote deploy failed (exit {code})", file=sys.stderr)
            return code

        print("Deploy finished.")
        return 0
    finally:
        tar_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
