from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(ROOT / '.env.local')
_load_env_file(ROOT / '.env')

try:
    from python_quantum.qaoa_service import optimize_live, retrieve_job  # noqa: E402
    QISKIT_IMPORT_ERROR: str | None = None
except Exception as exc:  # keep the helper alive long enough to return a JSON diagnosis
    optimize_live = None  # type: ignore[assignment]
    retrieve_job = None  # type: ignore[assignment]
    QISKIT_IMPORT_ERROR = str(exc)

HOST = '127.0.0.1'
PORT = int(os.getenv('QUANTUM_LOCAL_PORT', '8765'))


def _write(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    handler.send_response(status)
    handler.send_header('content-type', 'application/json; charset=utf-8')
    handler.send_header('cache-control', 'no-store')
    handler.send_header('access-control-allow-origin', 'http://localhost:3000')
    handler.send_header('access-control-allow-headers', 'content-type')
    handler.send_header('access-control-allow-methods', 'GET,POST,OPTIONS')
    handler.send_header('content-length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        print(f'[QISKIT] {format % args}')

    def do_OPTIONS(self) -> None:
        _write(self, 204, {})

    def do_GET(self) -> None:
        if urlparse(self.path).path == '/health':
            _write(self, 200, {'status': 'ok', 'python': True, 'qiskit': QISKIT_IMPORT_ERROR is None, 'error': QISKIT_IMPORT_ERROR})
            return
        _write(self, 404, {'status': 'error', 'error': 'Not found'})

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get('content-length', '0'))
            payload = json.loads(self.rfile.read(length) or b'{}')
            path = urlparse(self.path).path
            if path == '/optimize':
                if optimize_live is None:
                    _write(self, 503, {'status': 'error', 'error': f'Qiskit runtime is unavailable: {QISKIT_IMPORT_ERROR}'})
                    return
                result = optimize_live(payload)
                status = 200 if result.get('status') in {'completed', 'done', 'queued'} else 500
                _write(self, status, result)
                return
            if path == '/status':
                job_id = str(payload.get('job_id', ''))
                quantum_payload = payload.get('payload') or {}
                if not job_id:
                    _write(self, 400, {'status': 'error', 'error': 'job_id is required'})
                    return
                if retrieve_job is None:
                    _write(self, 503, {'status': 'error', 'error': f'Qiskit runtime is unavailable: {QISKIT_IMPORT_ERROR}'})
                    return
                result = retrieve_job(quantum_payload, job_id)
                status = 200 if str(result.get('status', '')).lower() in {'completed', 'done'} else 202
                _write(self, status, result)
                return
            _write(self, 404, {'status': 'error', 'error': 'Not found'})
        except Exception as exc:
            _write(self, 500, {'status': 'error', 'error': str(exc)})


if __name__ == '__main__':
    print(f'Local Qiskit engine listening on http://{HOST}:{PORT}')
    print('Runs the Qiskit Statevector simulator.')
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
