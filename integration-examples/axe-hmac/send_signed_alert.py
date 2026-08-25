"""Envio de um alerta ALRT→AXE com assinatura HMAC-SHA256 do corpo bruto."""

import hashlib
import hmac
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

endpoint = os.getenv("AXE_URL", "https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events")
api_key = os.getenv("AXE_API_KEY")
hmac_secret = os.getenv("AXE_HMAC_SECRET")

if not api_key or not hmac_secret:
    raise RuntimeError("Defina AXE_API_KEY e AXE_HMAC_SECRET no ambiente antes de executar.")

timestamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
external_id = os.getenv("ALERT_EXTERNAL_ID", f"demo-{uuid.uuid4()}")
correlation_id = str(uuid.uuid4())
payload = {
    "schemaVersion": "1.0",
    "eventId": f"evt_alrt_{uuid.uuid4()}",
    "eventType": "alert.received",
    "occurredAt": timestamp,
    "source": {"system": "despacho-alrt", "environment": "homologacao"},
    "correlationId": correlation_id,
    "idempotencyKey": f"alrt:alert:{external_id}:v1",
    "data": {
        "alert": {
            "externalId": external_id,
            "category": "Alerta urbano",
            "priority": "alta",
            "description": "Alerta de homologação assinado pelo ALRT.",
            "address": "Rua de Homologação, nº 100",
            "latitude": -27.0976,
            "longitude": -48.9104,
            "reportedAt": timestamp,
            "sourceStatus": "novo",
        }
    },
}

# serialização compacta e única: o mesmo conteúdo precisa ser assinado e enviado.
raw_body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
signed_value = timestamp.encode("utf-8") + b"." + raw_body
signature = "sha256=" + hmac.new(hmac_secret.encode("utf-8"), signed_value, hashlib.sha256).hexdigest()

request = urllib.request.Request(
    endpoint,
    data=raw_body,
    method="POST",
    headers={
        "Content-Type": "application/json",
        "X-ALRT-API-Key": api_key,
        "X-Timestamp": timestamp,
        "X-Request-Timestamp": timestamp,
        "X-Correlation-Id": correlation_id,
        "X-Signature": signature,
    },
)

try:
    with urllib.request.urlopen(request, timeout=15) as response:
        print(json.dumps({"status": response.status, "correlationId": correlation_id, "response": response.read().decode("utf-8")}, indent=2))
except urllib.error.HTTPError as error:
    print(json.dumps({"status": error.code, "correlationId": correlation_id, "response": error.read().decode("utf-8")}, indent=2), file=sys.stderr)
    raise SystemExit(1) from error
