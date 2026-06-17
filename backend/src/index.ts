import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { pool } from './db/pool';
import { runMigrations } from './db/migrate';
import { initWebSocket } from './services/websocket';

// Routes
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import userRoutes from './routes/users';
import expenseRoutes from './routes/expenses';
import paymentRoutes from './routes/payments';
import categoryRoutes from './routes/categories';
import testAuthRoutes from './routes/test-auth';
import activityLogRoutes from './routes/activity-logs';

const app = express();

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/auth', testAuthRoutes);
app.use('/api/activity-logs', activityLogRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
initWebSocket(server);

// Start server
server.listen(config.PORT, async () => {
  try {
    await runMigrations();
  } catch {
    console.error('❌ Failed to run migrations, server may not function correctly');
  }
  console.log(`🚀 SplitEasy backend running on http://localhost:${config.PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await pool.end();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await pool.end();
  server.close(() => process.exit(0));
});
