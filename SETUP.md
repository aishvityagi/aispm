# AI-SPM · Phase 1 Setup Guide
### For people new to this — every step explained

---

## What you need to install first (one-time setup)

Before anything else, install these tools on your machine.
Click each link, download, and run the installer for your OS.

| Tool | What it does | Download |
|------|-------------|---------|
| **Node.js v20+** | Runs the gateway and dashboard | https://nodejs.org (pick "LTS") |
| **Python 3.12+** | Runs the risk engine | https://python.org/downloads |
| **Docker Desktop** | Runs Postgres, Redis, Kafka locally | https://docker.com/products/docker-desktop |
| **Git** | Version control | https://git-scm.com/downloads |
| **VS Code** (recommended) | Code editor | https://code.visualstudio.com |

After installing, verify each one works by opening a terminal and running:

```bash
node --version      # should print v20.x.x or higher
python --version    # should print 3.12.x
docker --version    # should print Docker version 25.x.x or similar
git --version       # should print git version 2.x.x
```

> **"What is a terminal?"**
> - On Mac: press Cmd+Space, type "Terminal", hit Enter
> - On Windows: press Win+R, type "cmd", hit Enter (or use Windows Terminal)
> - On Linux: Ctrl+Alt+T

---

## Step 1 — Get the project on your machine

Open your terminal and run these commands one by one.
After each command, wait for it to finish before running the next.

```bash
# 1. Go to your home folder (safe place to put projects)
cd ~

# 2. Create a projects folder (skip if you already have one)
mkdir projects
cd projects

# 3. If you're starting fresh (no git repo yet), just copy the aispm folder here.
#    If you're cloning from GitHub later:
#    git clone https://github.com/YOUR_ORG/aispm.git
#    cd aispm
```

> After this step you should be inside the `aispm/` folder in your terminal.
> You can confirm this by running `pwd` — it should print a path ending in `/aispm`

---

## Step 2 — Set up environment variables

Environment variables are like secret configuration values your app reads at startup.
We keep them in a `.env` file that is never committed to Git.

```bash
# Inside the aispm/ folder, run:
cp .env.example .env
```

Now open `.env` in VS Code:

```bash
code .env
```

You'll see this file. For Phase 1, you only need to fill in the AI provider keys
if you want to test live calls (otherwise the stubs work without them):

```
OPENAI_API_KEY=sk-...         ← Get from https://platform.openai.com/api-keys
ANTHROPIC_API_KEY=sk-ant-...  ← Get from https://console.anthropic.com/keys
```

Everything else can stay as-is for local development.

---

## Step 3 — Install Node.js dependencies

This downloads all the JavaScript/TypeScript libraries the project needs.

```bash
# Make sure you're in the aispm/ folder, then run:
npm install
```

You'll see a lot of output — that's normal. It's downloading packages.
When it finishes you'll see your terminal prompt again.

> This creates a `node_modules/` folder. Don't worry about its size —
> it's normal for it to be several hundred MB.

---

## Step 4 — Build the shared packages

Our gateway and dashboard share common TypeScript types. Build them first:

```bash
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/policy-core
```

Each command should finish with no errors.
If you see red errors, copy them and we'll fix them together.

---

## Step 5 — Set up the Python risk engine

The risk engine uses Python with its own separate dependency system.

```bash
# Go into the risk engine folder
cd apps/risk-engine

# Create a virtual environment (isolated Python sandbox for this project)
python -m venv .venv

# Activate it:
# On Mac/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# You should now see (.venv) at the start of your terminal prompt.
# That means it's active. Now install dependencies:
pip install -r requirements.txt

# Go back to the root
cd ../..
```

> **Why a virtual environment?**
> It keeps this project's Python packages separate from everything else
> on your machine. Always activate it before working on the risk engine.

---

## Step 6 — Start the infrastructure with Docker

This starts Postgres, Redis, Kafka, and Elasticsearch locally.
Make sure Docker Desktop is running first (open it from your Applications).

```bash
# In the aispm/ root folder:
docker compose up postgres redis -d
```

The `-d` flag means "run in the background" so your terminal stays free.

Wait about 10 seconds, then check everything is healthy:

```bash
docker compose ps
```

You should see `postgres` and `redis` with status `healthy`.

> **Starting just Postgres and Redis for now** — Kafka and Elasticsearch
> are only needed from Phase 4 onwards. No need to run them yet.

---

## Step 7 — Start the services

Now open **three separate terminal windows/tabs** and run one command in each.

**Terminal 1 — Gateway:**
```bash
cd ~/projects/aispm
npm run dev --workspace=apps/gateway
```

You should see:
```
{"level":"info","msg":"Gateway listening on port 3000"}
```

**Terminal 2 — Risk Engine:**
```bash
cd ~/projects/aispm/apps/risk-engine
source .venv/bin/activate        # (.venv\Scripts\activate on Windows)
uvicorn src.main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Terminal 3 — Dashboard:**
```bash
cd ~/projects/aispm
npm run dev --workspace=apps/dashboard
```

You should see:
```
▲ Next.js 14.x
- Local: http://localhost:3001
```

---

## Step 8 — Verify everything is running

Open these URLs in your browser. Each should return a response:

| URL | What you should see |
|-----|-------------------|
| http://localhost:3000/health | `{"status":"ok","service":"aispm-gateway",...}` |
| http://localhost:8000/health | `{"status":"ok","service":"aispm-risk-engine",...}` |
| http://localhost:8000/docs | Interactive API docs (auto-generated by FastAPI) |
| http://localhost:3001 | Dashboard stub page with links |

---

## Step 9 — Test the risk engine manually

The risk engine has interactive docs at http://localhost:8000/docs
You can test the `/v1/analyze` endpoint directly from the browser.

Or use this curl command from your terminal:

```bash
curl -X POST http://localhost:8000/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-001",
    "prompt": "What is the capital of France?",
    "user_id": "user-123",
    "model": "gpt-4o"
  }'
```

Expected response:
```json
{
  "request_id": "test-001",
  "risk": {
    "score": 0.05,
    "level": "low",
    "categories": ["clean"],
    "confidence": 0.99,
    "explanation": "[Phase 1 stub] Real analysis coming in Phase 3"
  },
  "analyzed_at": "2025-..."
}
```

---

## Folder structure explained

```
aispm/
├── apps/
│   ├── gateway/          ← Node.js proxy server (Phase 2)
│   ├── risk-engine/      ← Python ML service (Phase 3)
│   └── dashboard/        ← Next.js admin UI (Phase 5)
├── packages/
│   ├── shared-types/     ← TypeScript types shared by all services ✅ Done
│   └── policy-core/      ← Policy rule engine ✅ Done
├── infra/
│   └── k8s/              ← Kubernetes manifests (Phase 6)
├── docker-compose.yml    ← Starts all infrastructure ✅ Done
├── .env.example          ← Template for environment variables ✅ Done
├── .env                  ← Your local config (never commit this!)
├── turbo.json            ← Monorepo task runner config ✅ Done
└── package.json          ← Root package config ✅ Done
```

---

## Common problems and fixes

**"command not found: npm"**
→ Node.js isn't installed or didn't add to PATH. Reinstall from nodejs.org.

**"Port 3000 already in use"**
→ Something else is using that port. Run: `lsof -i :3000` (Mac/Linux)
  or `netstat -ano | findstr :3000` (Windows) to find and kill it.

**"Cannot connect to Docker daemon"**
→ Docker Desktop isn't running. Open it from your Applications first.

**Python "ModuleNotFoundError"**
→ Your virtual environment isn't activated.
  Run `source apps/risk-engine/.venv/bin/activate` first.

**TypeScript build errors**
→ Run `npm install` again from the root, then retry the build.

---

## What's next — Phase 2

In Phase 2 we build the real gateway proxy:
- Intercepts every prompt before it reaches OpenAI/Claude
- Calls the risk engine for scoring
- Applies policy decisions (allow / block / redact)
- Streams responses back to the client

Say **"start Phase 2"** when you're ready.
