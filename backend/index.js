/**
 * KidTube Backend API — Entry Point
 *
 * This file is intentionally minimal. Its only responsibilities are:
 *   1. Configure Express and global middleware
 *   2. Mount route modules
 *   3. Start the HTTP server and keep-alive pinger
 *
 * All business logic lives in src/routes/ and src/middleware/.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'KidTube API',
    timestamp: new Date().toISOString(),
  });
});

// ─── Route Modules ────────────────────────────────────────────────────────────
app.use('/api', require('./src/routes/auth'));
app.use('/api/children', require('./src/routes/children'));
app.use('/api/channels', require('./src/routes/channels'));
app.use('/api/videos', require('./src/routes/videos'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/history', require('./src/routes/history'));
app.use('/api/sync', require('./src/routes/sync'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ KidTube Backend API listening on port ${PORT}`);

  // Keep Render free-tier instance awake by self-pinging every 14 minutes
  const PING_URL = process.env.PING_URL || 'https://kidtube-almy.onrender.com/health';
  setInterval(() => {
    fetch(PING_URL)
      .then((r) => { if (r.ok) console.log('[KeepAlive] ping OK'); })
      .catch(() => { /* ignore ping errors — network may be briefly unavailable */ });
  }, 14 * 60 * 1000);
});
