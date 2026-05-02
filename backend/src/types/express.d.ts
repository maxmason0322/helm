import type { auth } from '../auth.js';

type Session = typeof auth.$Infer.Session.session;
type User = typeof auth.$Infer.Session.user;

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}
