/**
 * Express application entry point.
 *
 * In production, also serves the built React frontend as static files
 * from ../frontend/dist. This eliminates CORS issues in deployment.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const expenseRoutes = require('./routes/expenses');
const { closeDb } = require('./db/database');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---

// Parse JSON bodies (with size limit to prevent abuse)
app.use(express.json({ limit: '1mb' }));

// CORS — permissive in dev, same-origin in production
if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
});

// --- API Routes ---
app.use('/api/expenses', expenseRoutes);

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Serve frontend in production ---
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendPath));
app.get('*', (req, res, next) => {
  // Only serve index.html for non-API routes
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) {
      // Frontend not built yet — that's fine in dev
      res.status(404).json({ error: 'Frontend not built. Run: cd frontend && npm run build' });
    }
  });
});

// --- Global error handler ---
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start server ---
const server = app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    port: PORT,
  });
});

// --- Graceful shutdown ---
function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    closeDb();
    logger.info('Server shut down');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
