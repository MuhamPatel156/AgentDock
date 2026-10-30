FROM node:24-bookworm-slim
LABEL agentdock.runtime.protocol="3" agentdock.python.protocol="1"
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/agentdock
COPY package.json ./package.json
RUN npm install --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY vite.config.mjs ./vite.config.mjs
COPY export.mjs ./export.mjs
COPY runtime.mjs ./runtime.mjs
COPY request.mjs ./request.mjs
COPY requirements.txt ./requirements.txt
RUN python3 -m venv /opt/agentdock/venv \
    && /opt/agentdock/venv/bin/python -m pip install --no-cache-dir --only-binary=:all: -r requirements.txt
COPY python_entry.py python_job.py pytest.ini ./
USER 1000:1000
WORKDIR /work
ENV NODE_ENV=production
