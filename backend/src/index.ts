import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { plaidRouter } from './routes/plaid.js';
import { accountsRouter } from './routes/accounts.js';
import { transactionsRouter } from './routes/transactions.js';
import { investmentsRouter } from './routes/investments.js';
import { activityRouter } from './routes/activity.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Better Auth handler — must be mounted BEFORE express.json()
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());

app.use('/api/plaid', plaidRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/investments', investmentsRouter);
app.use('/api/activity', activityRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Helm backend running on port ${port}`);
});
