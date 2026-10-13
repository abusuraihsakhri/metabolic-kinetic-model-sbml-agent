import os

from fastapi.testclient import TestClient

from agents.api import app
from agents.base import AuditTrail
from agents.models import SystemTaskPayload
from agents.supervisor import SystemSupervisor


def test_private_audit_log_endpoint_requires_token(monkeypatch):
    monkeypatch.setenv("AUDIT_SECRET_KEY", "test-only-secret")
    monkeypatch.delenv("AUDIT_LOG_READ_TOKEN", raising=False)
    client = TestClient(app)
    assert client.get("/api/audit/logs").status_code == 403
    monkeypatch.setenv("AUDIT_LOG_READ_TOKEN", "local-read-secret")
    assert client.get("/api/audit/logs", headers={"X-Audit-Token": "wrong"}).status_code == 403
    assert client.get("/api/audit/logs", headers={"X-Audit-Token": "local-read-secret"}).status_code == 200


def test_phi_in_attributes_is_blocked(monkeypatch):
    monkeypatch.setenv("AUDIT_SECRET_KEY", "test-only-secret")
    client = TestClient(app)
    payload={"task_id":"T1", "target_identifier":"S1", "primary_metric":1.0,
             "attributes":{"notes":"MRN-123456"}}
    response=client.post("/api/audit",json=payload)
    assert response.status_code == 422
    assert "MRN-123456" not in response.text


def test_audit_log_snapshot_cannot_mutate_chain():
    trail=AuditTrail(secret_key="test-only-secret")
    trail.log("test","test","test",{"a":1})
    snapshot=trail.get_trail()
    snapshot[0]["payload_hash"]="modified"
    assert trail.verify_integrity()
