# Metabolic Kinetic Model SBML Agent

Tools for **structural inspection of SBML XML** and **rule-based evaluation of numeric metrics**. The repository includes an entirely local browser interface, a Python CLI, and a FastAPI service.

> **Scope:** Structural inspection is not SBML schema validation. The evaluation thresholds are illustrative project rules, not calibrated clinical or biochemical limits. This repository does **not** implement ODE integration, kinetic parameter fitting, steady-state analysis, metabolic control coefficients, or flux-balance analysis. The enrichment classes are threshold-oriented prototypes, not implementations of those methods.

## Browser application

The static application is in [web/](web/). It can be hosted on GitHub Pages without a Python backend. It:

- Parses a local SBML XML file (maximum 2 MB) to inventory the model, compartments, species, parameters, reactions, stoichiometry, and declared kinetic laws (including MathML source).
- Applies the repository's existing illustrative metric rules: primary value > 25; secondary value > 12; critical flag; status-descriptor keyword checks.
- Exports SBML structure summaries and metric results as JSON.
- Runs completely in the browser without uploading input to a server, without browser storage, and without fabricating signed audits or model simulations.

Open locally over HTTP (ES modules may be restricted under `file://`):

```bash
python -m http.server 8080 --directory web
# Visit http://localhost:8080/
```

The app uses modern browser APIs (DOMParser, File/Blob, ES modules), and is intended for current Chrome, Firefox, Safari and Edge. Browser compatibility has not been exhaustively certified.

## Python installation

Requires Python 3.10 or newer.

```bash
git clone https://github.com/abusuraihsakhri/metabolic-kinetic-model-sbml-agent.git
cd metabolic-kinetic-model-sbml-agent
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[test]'
```

### SBML inspection

```bash
metabolic-kinetic-model-sbml-agent inspect-sbml my-model.xml
# Or: python -m sbml_kinetics.cli inspect-sbml my-model.xml
```

Outputs a JSON inventory. Rejects malformed XML, DTD/entity declarations, and input above 2 MB. It does not interpret SBML rules, kinetics, units, or solve equations.

### Rule-based evaluation and API

The repository retains two legacy evaluation paths: `cli.py` / `agents/` and `sbml_kinetics/cli.py` / `sbml_kinetics/`. They use different hard-coded secondary limits (12 versus 10); their results should not be treated as interchangeable or domain standards.

```bash
export AUDIT_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
python cli.py audit --task-id T1 --primary 28.5 --secondary 14.2 --status DISCORDANT
python cli.py batch -i sample.csv -o results.csv
python cli.py verify-audit
python cli.py serve --host 127.0.0.1 --port 8000
```

The main FastAPI app (`agents.api:app`) exposes `GET /health`, `GET /metrics` (JSON counts), `POST /api/audit`, `POST /api/chat` (deterministic mock, not actual model inference), and `GET /api/audit/logs`. Set `AUDIT_LOG_READ_TOKEN` and supply that value in the `X-Audit-Token` header to read audit logs; otherwise access is denied. Interactive API documentation is available at `/docs` when the local server is running.

The Python audit chain uses HMAC-SHA256 signatures and the environment-provided key; logs are **process-local, in memory, and not durable**. Do not expose the API publicly without independent authentication, HTTPS, access controls, and appropriate data governance. Its pattern-based identifier screen is not a complete PHI de-identification or HIPAA compliance solution.

Docker is available using `docker compose up --build` after securely setting `AUDIT_SECRET_KEY`; Compose binds the port to localhost by default. Never commit your populated `.env` file.

## Tests

```bash
python -m pytest -q
node --check web/app.js
node --test web/app.test.mjs
python -m build  # requires: python -m pip install build
```

CI checks Python 3.10–3.12, package builds, and the standalone browser evaluator. GitHub Pages deployment, when enabled, publishes the static `web/` directory; the Python REST service cannot run on GitHub Pages.

## License

[MIT](LICENSE).
