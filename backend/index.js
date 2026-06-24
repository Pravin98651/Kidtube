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

// ─── Environment Integrity Checks ─────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is missing.');
  process.exit(1);
}
if (!process.env.SYNC_SECRET) {
  console.error('❌ FATAL: SYNC_SECRET environment variable is missing.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Global Middleware ────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'exp://localhost:8081', 'http://localhost:8081'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('exp://') || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
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
});
