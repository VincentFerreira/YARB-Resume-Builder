"""
Lightweight synchronous MCP client over stdio transport.

Spawns a server subprocess, exchanges JSON-RPC 2.0 messages, and tears it down cleanly.
Intended for short-lived calls from the Telegram bot — one MCPClient per tool invocation.
"""
import json
import subprocess
from pathlib import Path
from typing import Any

_JSONRPC = "2.0"
_PROTO = "2024-11-05"


class MCPError(Exception):
    pass


class MCPClient:
    def __init__(self, command: str, args: list[str], cwd: str | None = None):
        self._proc = subprocess.Popen(
            [command, *args],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            cwd=cwd,
            text=True,
            bufsize=1,
        )
        self._id = 0

    # ------------------------------------------------------------------ lifecycle

    def __enter__(self):
        self.initialize()
        return self

    def __exit__(self, *_):
        self.close()

    def close(self):
        try:
            self._proc.stdin.close()
            self._proc.wait(timeout=5)
        except Exception:
            self._proc.kill()

    # ------------------------------------------------------------------ transport

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def _send(self, method: str, params: dict | None = None) -> Any:
        req_id = self._next_id()
        payload = {"jsonrpc": _JSONRPC, "id": req_id, "method": method}
        if params is not None:
            payload["params"] = params
        self._proc.stdin.write(json.dumps(payload) + "\n")
        self._proc.stdin.flush()

        while True:
            line = self._proc.stdout.readline()
            if not line:
                raise MCPError("Server closed stdout unexpectedly")
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("id") == req_id:
                if "error" in msg:
                    raise MCPError(msg["error"].get("message", str(msg["error"])))
                return msg.get("result")

    # ------------------------------------------------------------------ protocol

    def initialize(self) -> dict:
        return self._send("initialize", {
            "protocolVersion": _PROTO,
            "capabilities": {},
            "clientInfo": {"name": "telegram-bot", "version": "1.0"},
        })

    def list_tools(self) -> list[dict]:
        result = self._send("tools/list")
        return result.get("tools", []) if result else []

    def call_tool(self, name: str, arguments: dict | None = None) -> list[dict]:
        result = self._send("tools/call", {
            "name": name,
            "arguments": arguments or {},
        })
        if result is None:
            return []
        return result.get("content", [])


# ------------------------------------------------------------------ discovery

def load_mcp_servers(project_dir: str | Path = ".") -> dict[str, dict]:
    """
    Read .mcp.json from project_dir and return the mcpServers dict.
    Keys are server names, values contain command/args/cwd.
    """
    path = Path(project_dir) / ".mcp.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
        return data.get("mcpServers", {})
    except (json.JSONDecodeError, OSError):
        return {}
