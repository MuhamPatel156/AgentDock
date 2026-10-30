# Python environments in AgentDock

The project now supports five additional starting points and four Python job types. Studio still runs on Node.js; Python and its curated packages live inside the optional trusted Docker image. Developers do not install dependencies for each project in Studio.

## Starting points

| New project choice | Backend / entry | Main use |
| --- | --- | --- |
| Python / standard library web | `app.py`, no external dependencies | HTML frontend, health API, JSON POST example |
| Python / Flask web API | `app.py`, Flask | Web/API starter with unittest fixtures |
| Python / FastAPI web API | `app.py`, FastAPI + Uvicorn | Typed JSON endpoint and local frontend |
| React + Python Flask | React build, then `app.py` | Compiled React frontend served by Python |
| Python / script and CSV utility | `main.py`, standard library | Run a script, analyze editable CSV data, inspect JSON output |

Web starters provide `/api/health` and `/api/echo`, source-restricted asset serving, and tests. Their exported server binds to localhost on port 4182 by default. Studio overrides the internal port through the runtime manifest. Flask/standard-library starter servers are for local development; production deployment needs a reviewed server, authentication and operational setup appropriate to the application.

## Enable the image

1. Start Docker Desktop with Linux containers.
2. In this project folder, run `npm run sandbox:prepare`. Rebuild even if an older Node-only image exists. This downloads the Node base, Linux Python, and pinned packages once.
3. Set `AGENTDOCK_ENABLE_BUILDS=1` for jobs and `AGENTDOCK_ENABLE_SERVERS=1` for temporary web backends in your local configuration. Keep API keys private; no key changes are needed.
4. Restart Studio, run `npm run doctor`, then create one of the new Python projects.

The image advertises runtime protocol 2 / Python protocol 1. Python requests fail with a rebuild instruction when the Python image label is missing. No image is pulled or package installed automatically during a project job.

## Runtime actions

| Action | Behavior |
| --- | --- |
| Inspect environment | Validates the entry/manifest and supported requirements; shows limits and package catalog. Executes no code. |
| Python syntax | Uses `ast.parse` for all `.py` files without importing/executing project code. |
| Python unittest | Discovers `test_*.py`; a zero-test run fails instead of reporting success. |
| Python pytest | Runs the image's pytest with a fixed config, disabled plugin autoload and no cache provider. Project test/conftest code executes inside the approved container. |
| Run Python script | Executes the configured Python entry when runtime `kind` is `script`. Shows bounded stdout/stderr. |
| Start current backend | Starts an approved Python web snapshot; React + Python compiles its frontend first. Existing log/stop/recovery/expiry controls apply. |

Syntax/tests/scripts require the Python execution checkbox. Web starts require the separate temporary-server checkbox. Jobs keep the existing network/resource restrictions: no external network or published ports, read-only root/source mounts, no host credentials or Docker socket, 512 MB RAM, one CPU, bounded PIDs/temp storage/output and a 90-second job timeout. Live servers have a maximum 15-minute lifetime. Generated job files and in-memory backend data are temporary. Save source changes in the editor and export source separately.

Example manifest:

```json
{"language":"python","entry":"app.py","kind":"web","port":3000,"build":false}
```

For a script, choose `entry:"main.py"` and `kind:"script"`. For React + Python, use `build:true`. Arbitrary shell commands and per-project install scripts are not accepted.

## Curated dependencies

The image pins Flask 3.1.3, FastAPI 0.162.0, Uvicorn 0.54.0 and pytest 9.2.0. Versions/Python requirements were checked against the maintainers' PyPI listings on 30 October 2026:

- https://pypi.org/project/Flask/3.1.3/
- https://pypi.org/project/fastapi/0.162.0/
- https://pypi.org/project/uvicorn/0.54.0/
- https://pypi.org/project/pytest/9.2.0/

`requirements.txt` accepts these names or exact matching `==` pins. URLs, editable/local installs, pip flags, version ranges and unsupported packages are rejected. `pyproject.toml` is editable/exportable metadata; its dependencies and scripts are not automatically executed. To add a reviewed library, update both the image requirements and `dist/environments.mjs`, rebuild the trusted image and rerun tests. Transitive package locking and audited image digest pinning remain work for a hosted beta.

## Verification and exports

Verification requires source-matched Python syntax results, plus unittest or pytest results when test files exist. Script profiles also require a script-run result. React + Python requires a matching React build. Editing any source file invalidates older evidence. These checks are not a security/production certification.

Source ZIP/folder/GitHub exports include Python/config/data files. The existing Netlify adapter rejects Python backend projects to avoid publishing their source as a static site. Export to a Python-capable host; automatic Python cloud deployment, persistent databases, Jupyter kernels, GPU/ML environments and arbitrary pip libraries are not implemented.

The editor now supports `.py`, `.toml`, `.yaml`, `.yml`, `.sql`, `.csv` and `.ini` text files, file-name search, individual downloads, and reviewable renames. Renaming the configured entry also proposes its manifest update. Review imports and asset roots after moving source files.

## Test scope

The automated suite uses the local Python interpreter only for trusted test fixtures: syntax checks for all starters, stdlib/script unittest, script JSON output, and actual GET/POST/source-withholding tests. Ordinary Studio project execution remains container-only. Full source tests require Python 3.11+ on the development machine as well as Node 24+. The prepared-image dependency resolver and actual Flask/FastAPI container execution still require a live Docker engine; they have not been verified on this laptop while its engine is stopped.
