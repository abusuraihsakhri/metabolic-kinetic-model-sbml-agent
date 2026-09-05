# Metabolic Kinetic Model SBML Agent

> **Domain:** Computational Biology & AI Drug Discovery  
> **Standards:** SBML Level 3 Version 2, CAP / CLSI / ISO

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3776AB.svg?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg?logo=fastapi&logoColor=white)
![Audit Trail](https://img.shields.io/badge/Audit-HMAC--SHA256_Tamper--Evident-brightgreen.svg)
![Zero-PHI Guard](https://img.shields.io/badge/Guard-Zero--PHI_Outbound-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)

</div>

---

## Overview

Metabolic Kinetic Model SBML Agent is a multi-agent evaluation platform for kinetic systems biology models. It provides:

- **Multi-Agent Consensus**: Specialized workers evaluate task payloads against domain thresholds
- **HMAC-SHA256 Audit Trail**: Cryptographically signed, tamper-evident logging of all evaluations
- **Zero-PHI Guard**: Outbound data inspection blocking SSNs, MRNs, phone numbers, and patient identifiers
- **FastAPI REST API**: OpenAPI 3.1 endpoints for programmatic access
- **Prometheus Metrics**: Operational telemetry export

---

## Architecture

The project contains two parallel agent systems:

### 1. Clinical & Biomedical AI Agent (`agents/`)

| Module | Purpose |
|--------|---------|
| `base.py` | Security guards, PHI detection, HMAC audit trail |
| `models.py` | Pydantic schemas for tasks, alerts, dossiers |
| `workers.py` | Specialized evaluation workers (QC, Safety, Conformance) |
| `supervisor.py` | Orchestrator coordinating multi-worker consensus |
| `api.py` | FastAPI REST endpoints |
| `llm_factory.py` | LLM provider abstraction (mock, Ollama, Claude, OpenAI) |
| `learning.py` | Bayesian calibration & active learning feedback |
| `metrics.py` | Prometheus metrics exporter |
| `streamer.py` | WebSocket telemetry broadcaster |

### 2. SBML-Kinetics Agent (`sbml_kinetics/`)

| Module | Purpose |
|--------|---------|
| `engine.py` | Core algorithmic engine for parameter evaluation |
| `agents.py` | Specialized sub-agents (Rate Law, ODE Solver, MCA) |
| `cli.py` | Command-line interface |
| `server.py` | FastAPI server factory |

---

## Installation

```bash
# Clone the repository
git clone https://github.com/abusuraihsakhri/metabolic-kinetic-model-sbml-agent.git
cd metabolic-kinetic-model-sbml-agent

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn pydantic pytest
```

---

## Configuration

Set the required environment variable for the audit trail:

```bash
export AUDIT_SECRET_KEY="your-secure-random-key-here"
```

For Docker deployments, set it in your `.env` file or docker-compose environment.

---

## Usage

### CLI Commands

```bash
# Run single task evaluation
python cli.py audit --task-id TASK-001 --primary 28.5 --secondary 14.2 --critical --status DISCORDANT

# Batch process CSV records
python cli.py batch -i sample.csv -o results.csv

# Query the supervisory chat
python cli.py chat "What is the system status?"

# Verify audit trail integrity
python cli.py verify-audit

# Launch REST API server
python cli.py serve --host 127.0.0.1 --port 8000
```

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |
| `/api/audit` | POST | Submit task for evaluation |
| `/api/chat` | POST | Query supervisory assistant |
| `/api/audit/logs` | GET | Retrieve audit trail |

### Example API Request

```bash
curl -X POST http://localhost:8000/api/audit \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "TASK-001",
    "target_identifier": "TARGET-01",
    "primary_metric": 28.5,
    "secondary_metric": 14.2,
    "status_descriptor": "DISCORDANT",
    "is_critical_flag": true
  }'
```

---

## Input Data Schema

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `task_id` | string | Unique task identifier | Yes |
| `target_identifier` | string | Target entity identifier | Yes |
| `primary_metric` | float | Primary measurement value | Yes |
| `secondary_metric` | float | Secondary kinetic index | No (default: 0.0) |
| `status_descriptor` | string | Status/phenotype code | No (default: "NOMINAL") |
| `is_critical_flag` | boolean | Emergency escalation flag | No (default: false) |

---

## Testing

```bash
# Run all tests
pytest -v

# Run with coverage
pytest -v --cov=agents --cov=sbml_kinetics

# Run simulation benchmark
python simulator.py 1000
```

---

## Docker Deployment

```bash
# Build and run with Docker Compose
export AUDIT_SECRET_KEY="your-production-key"
docker-compose up --build

# Or use Docker directly
docker build -t metabolic-kinetic-model-sbml-agent .
docker run -p 8000:8000 -e AUDIT_SECRET_KEY="your-key" metabolic-kinetic-model-sbml-agent
```

---

## Security Features

- **Zero-PHI Outbound Interceptor**: AST and regex inspection blocking SSNs, MRNs, phone numbers, emails, DOBs, and patient names
- **Tamper-Evident HMAC-SHA256 Audit Trail**: Chained, cryptographically signed logs with signature verification
- **Input Validation**: Pydantic models reject NaN, infinite, and empty values
- **Secure Defaults**: No hardcoded secrets; AUDIT_SECRET_KEY required at runtime

---

## License

MIT License - see [LICENSE](LICENSE) for details.
