import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { requireAuth } from './middleware/auth.js';
import { plaidRouter } from './routes/plaid.js';
import { accountsRouter } from './routes/accounts.js';
import { transactionsRouter } from './routes/transactions.js';
import { investmentsRouter } from './routes/investments.js';
import { activityRouter } from './routes/activity.js';
import { coinbaseRouter } from './routes/coinbase.js';
import { dashboardRouter } from './routes/dashboard.js';

// Validate required env vars at startup
const required = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY', 'PLAID_CLIENT_ID', 'PLAID_SECRET'] as const;
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

// Rate limiting on auth endpoints — 10 requests per minute per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});
app.use('/api/auth', authLimiter);

// Better Auth handler — must be mounted BEFORE express.json()
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());

// Rate limiting on Plaid endpoints — 20 requests per minute per IP
const plaidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});

// Plaid webhook — public endpoint, no session auth (will use Plaid signature verification in HLM-14)
app.post('/api/plaid/webhook', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// Protected API routes
app.use('/api/plaid', requireAuth, plaidLimiter, plaidRouter);
app.use('/api/accounts', requireAuth, plaidLimiter, accountsRouter);
app.use('/api/transactions', requireAuth, plaidLimiter, transactionsRouter);
app.use('/api/investments', requireAuth, plaidLimiter, investmentsRouter);
app.use('/api/coinbase', requireAuth, plaidLimiter, coinbaseRouter);
app.use('/api/dashboard', requireAuth, plaidLimiter, dashboardRouter);
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
