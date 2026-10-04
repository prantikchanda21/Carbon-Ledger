from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler

try:
    from python_quantum.qaoa_service import optimize_live
    _QISKIT_IMPORT_ERROR = None
except Exception as exc:
    optimize_live = None
    _QISKIT_IMPORT_ERROR = str(exc)


def _json_response(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    encoded = json.dumps(body, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "content-type")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)


class handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return

    def do_OPTIONS(self) -> None:
        _json_response(self, 204, {})

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("content-length", "0"))
            raw = self.rfile.read(length)
            payload = json.loads(raw or b"{}")
            if optimize_live is None:
                _json_response(self, 503, {"status": "error", "code": "qiskit_unavailable", "error": _QISKIT_IMPORT_ERROR or "Qiskit runtime is unavailable"})
                return
            result = optimize_live(payload)
            _json_response(self, 200 if result.get("status") == "completed" else 202, result)
        except Exception as exc:
            _json_response(self, 500, {"status": "error", "error": str(exc)})
