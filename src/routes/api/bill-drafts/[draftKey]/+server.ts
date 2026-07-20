import {
  assertDraftKey,
  draftStore,
  DraftConflictError,
  DraftNotFoundError,
  DraftValidationError,
  type DraftStore
} from '$lib/server/bill-drafts.js';
import type { RequestHandler } from './$types';

const JSON_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store'
};
const MAX_BODY_BYTES = 1_048_576;

function jsonBody(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}

function mapError(error: unknown, draftKey: string, operation: string): Response {
  if (error instanceof DraftConflictError) {
    return jsonBody({ error: 'conflict', serverRevision: error.serverRevision }, 409);
  }
  if (error instanceof DraftNotFoundError) return jsonBody({ error: 'not_found' }, 404);
  if (error instanceof DraftValidationError) return jsonBody({ error: 'validation', message: error.message, fields: error.fields }, 400);
  console.error('Bill draft operation failed', { draftKey, operation, error: error instanceof Error ? error.name : 'UnknownError' });
  return jsonBody({ error: 'server_error' }, 500);
}

async function readJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new DraftValidationError('Request body is too large');
  }
  try {
    return await request.json();
  } catch {
    throw new DraftValidationError('Malformed JSON');
  }
}

export function _createDraftHandlers(store: DraftStore) {
  const GET: RequestHandler = async ({ params }) => {
    try {
      assertDraftKey(params.draftKey);
      const draft = store.getDraft(params.draftKey);
      return draft ? jsonBody({ draft }) : jsonBody({ error: 'not_found' }, 404);
    } catch (error) {
      return mapError(error, params.draftKey, 'get');
    }
  };

  const PUT: RequestHandler = async ({ params, request }) => {
    try {
      assertDraftKey(params.draftKey);
      const body = await readJson(request) as Record<string, unknown>;
      if (!Number.isInteger(body.expectedRevision) || (body.expectedRevision as number) < 0) {
        throw new DraftValidationError('expectedRevision must be a nonnegative integer');
      }
      const saved = store.saveDraft({
        draftKey: params.draftKey,
        expectedRevision: body.expectedRevision as number,
        payload: body.payload
      });
      return jsonBody(saved);
    } catch (error) {
      return mapError(error, params.draftKey, 'save');
    }
  };

  const DELETE: RequestHandler = async ({ params }) => {
    try {
      assertDraftKey(params.draftKey);
      return store.deleteDraft(params.draftKey)
        ? new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
        : jsonBody({ error: 'not_found' }, 404);
    } catch (error) {
      return mapError(error, params.draftKey, 'delete');
    }
  };

  return { GET, PUT, DELETE };
}

export const { GET, PUT, DELETE } = _createDraftHandlers(draftStore);
