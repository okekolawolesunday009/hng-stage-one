# 🚀 HNG DevOps Stage 1 — Full Run Guide

> **Goal:** Build a secure API, deploy it with systemd + nginx, resource-limit it, and push clean code to GitHub.

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Structure](#2-project-structure)
3. [Build the API](#3-build-the-api)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Set Up GitHub Actions Workflow](#5-set-up-github-actions-workflow)
6. [Deploy to Server](#6-deploy-to-server)
7. [Create the systemd Service](#7-create-the-systemd-service)
8. [Configure nginx Reverse Proxy](#8-configure-nginx-reverse-proxy)
9. [Configure the Firewall](#9-configure-the-firewall)
10. [Test All Endpoints](#10-test-all-endpoints)
11. [Write the README](#11-write-the-readme)
12. [Push to GitHub (Secret-Safe)](#12-push-to-github-secret-safe)
13. [Submission Checklist](#13-submission-checklist)

---

## 1. Prerequisites

On your server (from Stage 0 — nginx already installed):

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Confirm versions
node -v
npm -v
nginx -v
```

---

## 2. Project Structure

```
my-api/
├── src/
│   └── index.js        # Main API file
├── .env                # ⚠️ NEVER commit this
├── .env.example        # ✅ Commit this (no real values)
├── .gitignore          # Must include .env
├── package.json
└── README.md
```

---

## 3. Build the API

### 3a. Initialize the project

```bash
mkdir ~/my-api && cd ~/my-api
npm init -y
npm install express dotenv axios
```

### 3b. Create `src/index.js`

```js
const express = require('express');
const os = require('os');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = 'HNG-DEVOPS-STAGE-1-SECRET-KEY';

// ── Middleware: API Key Auth ──────────────────────────────────────────────────
app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing X-Api-Key',
    });
  }
  next();
});

// ── GET / ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({ message: 'API is running' });
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const cpus = os.cpus();
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = ((totalMem - freeMem) / 1024 / 1024).toFixed(2);

  res.status(200).json({
    cpu_usage: `${cpuUsage.toFixed(2)}%`,
    memory_usage: `${usedMem} MB`,
  });
});

// ── GET /me ───────────────────────────────────────────────────────────────────
app.get('/me', async (req, res) => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
  const REPO_NAME = process.env.REPO_NAME;

  try {
    const workflowRes = await axios.get(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/actions/runs?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    const latestRun = workflowRes.data.workflow_runs[0];

    res.status(200).json({
      name: process.env.FULL_NAME,
      email: process.env.EMAIL,
      github_url: `https://github.com/${GITHUB_USERNAME}`,
      repo_name: REPO_NAME,
      workflow_status: latestRun?.status || 'unknown',
      workflow_conclusion: latestRun?.conclusion || 'unknown',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workflow data', details: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
```

---

## 4. Configure Environment Variables

### 4a. Create `.env` on the server (DO NOT commit this file)

```bash
nano ~/my-api/.env
```

Paste and fill in your real values:

```env
PORT=3000
FULL_NAME=Your Full Name
EMAIL=you@example.com
GITHUB_USERNAME=yourusername
REPO_NAME=your-repo-name
GITHUB_TOKEN=ghp_XXXXXXXXXXXXXXXXXXXX
```

### 4b. Create `.env.example` (safe to commit)

```bash
cat > ~/my-api/.env.example << 'EOF'
PORT=3000
FULL_NAME=
EMAIL=
GITHUB_USERNAME=
REPO_NAME=
GITHUB_TOKEN=
EOF
```

### 4c. Create `.gitignore`

```bash
cat > ~/my-api/.gitignore << 'EOF'
node_modules/
.env
*.log
EOF
```

---

## 5. Set Up GitHub Actions Workflow

This creates a workflow so the `/me` endpoint can report a real deployment status.

```bash
mkdir -p ~/my-api/.github/workflows
nano ~/my-api/.github/workflows/deploy.yml
```

Paste:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Deploy to server
        run: echo "Deployment step — extend with SSH/rsync as needed"
```

> **Note:** Push this to GitHub before you need the `/me` endpoint to return real data.

---

## 6. Deploy to Server

```bash
# Copy your project to the server (run this from your local machine)
scp -r ./my-api user@YOUR_SERVER_IP:~/my-api

# OR if you're already on the server, clone from GitHub:
git clone https://github.com/yourusername/your-repo-name.git ~/my-api
cd ~/my-api
npm install

# Create the .env file on the server (never push .env to git)
nano ~/my-api/.env   # fill in your values as shown in Step 4
```

---

## 7. Create the systemd Service

```bash
sudo nano /etc/systemd/system/my-api.service
```

Paste the following (replace `ubuntu` with your actual username):

```ini
[Unit]
Description=HNG DevOps Stage 1 API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/my-api
ExecStart=/usr/bin/node /home/ubuntu/my-api/src/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/home/ubuntu/my-api/.env

# ── Resource Limits ──────────────────────────
CPUQuota=10%
MemoryMax=128M
MemorySwapMax=0

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable my-api
sudo systemctl start my-api
sudo systemctl status my-api
```

Verify resource limits are active:

```bash
sudo systemctl show my-api | grep -E "CPUQuota|MemoryMax"
```

---

## 8. Configure nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/my-api
```

Paste:

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP_OR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 10s;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/my-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. Configure the Firewall

Block direct access to port 3000; only allow nginx ports:

```bash
# Allow SSH so you don't lock yourself out
sudo ufw allow 22/tcp

# Allow nginx traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct app port
sudo ufw deny 3000/tcp

# Enable the firewall
sudo ufw enable

# Confirm rules
sudo ufw status verbose
```

Expected output should show port 3000 as DENY and ports 22/80/443 as ALLOW.

---

## 10. Test All Endpoints

Replace `http://YOUR_SERVER_IP` with your actual server address.

```bash
# ── GET / ────────────────────────────────────────────────────────────────────
curl -s -H "X-Api-Key: HNG-DEVOPS-STAGE-1-SECRET-KEY" http://YOUR_SERVER_IP/
# Expected: {"message":"API is running"}

# ── GET /health ───────────────────────────────────────────────────────────────
curl -s -H "X-Api-Key: HNG-DEVOPS-STAGE-1-SECRET-KEY" http://YOUR_SERVER_IP/health
# Expected: {"cpu_usage":"X%","memory_usage":"X MB"}

# ── GET /me ───────────────────────────────────────────────────────────────────
curl -s -H "X-Api-Key: HNG-DEVOPS-STAGE-1-SECRET-KEY" http://YOUR_SERVER_IP/me
# Expected: full JSON with name, email, github_url, repo_name, workflow_status, workflow_conclusion

# ── Test 401 Unauthorized ─────────────────────────────────────────────────────
curl -s http://YOUR_SERVER_IP/
# Expected: {"error":"Unauthorized","message":"Invalid or missing X-Api-Key"}

# ── Test Response Time ────────────────────────────────────────────────────────
curl -s -o /dev/null -w "%{time_total}s\n" \
  -H "X-Api-Key: HNG-DEVOPS-STAGE-1-SECRET-KEY" \
  http://YOUR_SERVER_IP/me
# Must be under 0.3s (300ms)
```

---

## 11. Write the README

Create `README.md` in your repo root:

```markdown
# HNG DevOps Stage 1 — Personal API

A secure REST API deployed with systemd + nginx on a Linux server.

## Live URL
http://YOUR_SERVER_IP_OR_DOMAIN

## Local Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

4. Start the server:
   ```bash
   node src/index.js
   ```

## API Endpoints

All requests require the header:
```
X-Api-Key: HNG-DEVOPS-STAGE-1-SECRET-KEY
```

| Endpoint  | Method | Description |
|-----------|--------|-------------|
| `/`       | GET    | Returns API running status |
| `/health` | GET    | Returns CPU and memory usage |
| `/me`     | GET    | Returns profile + latest GitHub Actions workflow status |

### Unauthorized (401)
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing X-Api-Key"
}
```

### GET /health
```json
{
  "cpu_usage": "3.45%",
  "memory_usage": "512.00 MB"
}
```

### GET /me
```json
{
  "name": "Your Full Name",
  "email": "you@example.com",
  "github_url": "https://github.com/yourusername",
  "repo_name": "your-repo-name",
  "workflow_status": "completed",
  "workflow_conclusion": "success"
}
```
```

---

## 12. Push to GitHub (Secret-Safe)

```bash
cd ~/my-api

# Make sure .env is in .gitignore BEFORE the first commit
cat .gitignore   # should show .env

git init
git add .
git commit -m "feat: add Stage 1 API with systemd and nginx"

git remote add origin https://github.com/yourusername/your-repo-name.git
git branch -M main
git push -u origin main
```

> ⚠️ **NEVER** run `git add .env`. If you accidentally committed secrets, use `git filter-repo` or BFG Repo Cleaner to purge the history before going public.

---

## 13. Submission Checklist

Before submitting in `#stage-one-devops`:

- [ ] `GET /` returns `{"message": "API is running"}` with 200
- [ ] `GET /health` returns CPU and memory with 200
- [ ] `GET /me` returns all fields including `workflow_status` and `workflow_conclusion`
- [ ] Missing or wrong API key returns 401 with correct JSON body
- [ ] All responses include `Content-Type: application/json`
- [ ] All endpoints respond in under 300ms
- [ ] systemd service is active: `sudo systemctl status my-api`
- [ ] CPUQuota=10% and MemoryMax=128M are set in the service file
- [ ] Port 3000 is firewalled (`ufw status` shows DENY for 3000)
- [ ] nginx reverse proxy is serving traffic on port 80
- [ ] GitHub repo is **public**
- [ ] `.env` is in `.gitignore` and is **not** in the repo history
- [ ] `README.md` includes setup instructions, endpoints, and live URL
- [ ] GitHub Actions workflow has at least one run (so `/me` returns real data)

---

**Good luck — you've got this! 🚀**
