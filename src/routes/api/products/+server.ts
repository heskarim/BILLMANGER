import { json } from '@sveltejs/kit';
import { searchProducts } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get('q') || '';
  try {
    const products = searchProducts(q);
    return json(products);
  } catch (err) {
    console.error('API products error:', err);
    return json({ error: 'Failed to search products' }, { status: 500 });
  }
};
