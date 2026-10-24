from __future__ import annotations

import json
import urllib.request

payload = {"mode": "simulator", "regions": []}

try:
    with urllib.request.urlopen('http://127.0.0.1:8765/health', timeout=3) as response:
        body = json.loads(response.read().decode())
    print(body)
except Exception as exc:
    raise SystemExit(f'Quantum helper is not reachable: {exc}')
