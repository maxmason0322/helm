import { db } from '../db/index.js';
import { activityLog } from '../db/schema.js';

export async function logActivity(userId: string | null, action: string, metadata?: Record<string, unknown>) {
  await db.insert(activityLog).values({
    userId,
    action,
    metadata: metadata ?? null,
  });
}
