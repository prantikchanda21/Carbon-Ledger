from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    from python_quantum.qaoa_service import optimize_live, retrieve_job
except Exception as exc:  # pragma: no cover - diagnosed at runtime
    print(json.dumps({
        "status": "error",
        "code": "qiskit_unavailable",
        "error": f"Qiskit import failed: {exc}",
    }))
    raise SystemExit(0)


def main() -> None:
    raw = sys.stdin.read()
    payload = json.loads(raw or "{}")
    operation = str(payload.pop("__operation", "optimize"))
    if operation == "optimize":
        result = optimize_live(payload)
    elif operation == "status":
        job_id = str(payload.pop("__job_id", ""))
        if not job_id:
            raise ValueError("job_id is required")
        result = retrieve_job(payload, job_id)
    else:
        raise ValueError(f"Unsupported quantum operation: {operation}")
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, separators=(",", ":")))
