import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/index.js';

const allowedEmails = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  baseURL: process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`,
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh after 1 day
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (allowedEmails.length > 0 && !allowedEmails.includes(user.email.toLowerCase())) {
            throw new Error('Registration is not available');
          }
          return user;
        },
      },
    },
  },
});
