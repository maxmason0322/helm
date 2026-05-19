import { db } from '../db/index.js';
import { activityLog } from '../db/schema.js';

export async function logActivity(userId: string | null, action: string, metadata?: Record<string, unknown>, tx?: { insert: typeof db.insert }) {
  try {
    const handle = tx || db;
    await handle.insert(activityLog).values({
      userId,
      action,
      metadata: metadata ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Failed to log activity "${action}":`, message);
    // Non-fatal — don't break the parent operation
  }
}
