"""
FastAPI REST API Server for Metabolic Kinetic Model Sbml Agent.
"""
import os
import secrets
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from .base import AuditLogger, PHIGuard, SecurityException
from .models import SystemTaskPayload, ConsensusDossier
from .supervisor import SystemSupervisor

supervisor = SystemSupervisor(model_provider="mock")

app = FastAPI(
    title="Metabolic Kinetic Model Sbml Agent API",
    description="Rule-based metric evaluation and local HMAC audit trail; not an SBML validator or ODE solver",
    version="2.0.1",
)


@app.exception_handler(SecurityException)
async def security_exception_handler(request: Request, exc: SecurityException):
    if "PHI Outbound Guard" in str(exc):
        return JSONResponse(status_code=422, content={"detail": "Input contains a prohibited identifier."})
    return JSONResponse(status_code=503, content={"detail": "Audit service is not configured."})


class ChatRequest(BaseModel):
    query: str


@app.get("/health")
def health():
    return {"status": "HEALTHY", "service": "metabolic-kinetic-model-sbml-agent", "domain": "Heuristic metric evaluation", "standard": "Project-defined thresholds", "version": "2.0.1"}


@app.get("/metrics")
def metrics():
    return {
        "dossiers_processed_total": len(supervisor.dossier_registry),
        "audit_blocks_total": len(AuditLogger.get_trail()),
        "system_status": "NOMINAL_OPTIMAL"
    }


@app.post("/api/audit")
def api_audit(payload: SystemTaskPayload):
    dossier = supervisor.process_task(payload)
    return dossier.to_dict()


@app.post("/api/chat")
def api_chat(req: ChatRequest):
    try:
        ans = supervisor.query_supervisory_chat(req.query)
        return {"response": ans}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/audit/logs")
def api_audit_logs(x_audit_token: Optional[str] = Header(default=None)):
    configured = os.environ.get("AUDIT_LOG_READ_TOKEN", "")
    if not configured or not x_audit_token or not secrets.compare_digest(configured, x_audit_token):
        raise HTTPException(status_code=403, detail="Audit log access is disabled or unauthorized.")
    return {"audit_trail": AuditLogger.get_trail(), "verified": AuditLogger.verify_integrity()}
