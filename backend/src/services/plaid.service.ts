import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const validEnvs = ['sandbox', 'production'] as const;
const plaidEnv = process.env.PLAID_ENV || 'sandbox';

if (!validEnvs.includes(plaidEnv as typeof validEnvs[number])) {
  throw new Error(`Invalid PLAID_ENV: "${plaidEnv}". Must be one of: ${validEnvs.join(', ')}`);
}

const config = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
    timeout: 30_000,
  },
});

export const plaidClient = new PlaidApi(config);
