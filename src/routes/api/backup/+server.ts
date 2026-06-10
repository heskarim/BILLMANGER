import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const dbPath = join(process.cwd(), 'billing.db');
    const fileBuffer = readFileSync(dbPath);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': 'attachment; filename="billing_backup.db"'
      }
    });
  } catch (err: any) {
    console.error('Backup download error:', err);
    return new Response(JSON.stringify({ error: `Failed to export backup: ${err.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
