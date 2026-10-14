from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

try:
    from python_quantum.qaoa_service import retrieve_job
    _QISKIT_IMPORT_ERROR = None
except Exception as exc:
    retrieve_job = None
    _QISKIT_IMPORT_ERROR = str(exc)


def _json_response(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    encoded = json.dumps(body, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "content-type")
    handler.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)


def _poll(handler: BaseHTTPRequestHandler, job_id: str, payload: dict) -> None:
    if not job_id:
        _json_response(handler, 400, {"status": "error", "error": "job_id is required"})
        return
    if retrieve_job is None:
        _json_response(handler, 503, {"status": "error", "code": "qiskit_unavailable", "error": _QISKIT_IMPORT_ERROR or "Qiskit runtime is unavailable"})
        return
    result = retrieve_job(payload, job_id)
    raw_status = str(result.get("status", "")).lower()
    status = 200 if raw_status in {"completed", "done"} else 202
    if raw_status in {"cancelled", "canceled", "error", "failed"}:
        status = 500
    _json_response(handler, status, result)


class handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return

    def do_OPTIONS(self) -> None:
        _json_response(self, 204, {})

    def do_GET(self) -> None:
        try:
            query = parse_qs(urlparse(self.path).query)
            job_id = query.get("job_id", [""])[0]
            payload_text = query.get("payload", [""])[0]
            payload = json.loads(payload_text) if payload_text else {}
            _poll(self, job_id, payload)
        except Exception as exc:
            _json_response(self, 500, {"status": "error", "error": str(exc)})

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("content-length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise ValueError("request body must be an object")
            job_id = str(body.get("job_id", ""))
            payload = body.get("payload") if isinstance(body.get("payload"), dict) else {}
            _poll(self, job_id, payload)
        except Exception as exc:
            _json_response(self, 500, {"status": "error", "error": str(exc)})
