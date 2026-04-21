
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

// ── Start .─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`API running on port ${PORT}`));