import { json } from '@sveltejs/kit';
import { searchClients } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get('q') || '';
  try {
    const clients = searchClients(q);
    return json(clients);
  } catch (err) {
    console.error('API clients error:', err);
    return json({ error: 'Failed to search clients' }, { status: 500 });
  }
};
