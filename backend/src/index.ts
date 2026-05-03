import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { requireAuth } from './middleware/auth.js';
import { plaidRouter } from './routes/plaid.js';
import { accountsRouter } from './routes/accounts.js';
import { transactionsRouter } from './routes/transactions.js';
import { investmentsRouter } from './routes/investments.js';
import { activityRouter } from './routes/activity.js';

// Validate required env vars at startup
const required = ['DATABASE_URL', 'JWT_SECRET'] as const;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const port = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Better Auth handler — must be mounted BEFORE express.json()
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());

// Protected API routes
app.use('/api/plaid', requireAuth, plaidRouter);
app.use('/api/accounts', requireAuth, accountsRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/investments', requireAuth, investmentsRouter);
app.use('/api/activity', requireAuth, activityRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Helm backend running on port ${port}`);
});
