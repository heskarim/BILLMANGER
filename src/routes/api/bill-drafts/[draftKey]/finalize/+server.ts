import {
  assertDraftKey,
  draftStore,
  DraftConflictError,
  DraftNotFoundError,
  DraftValidationError,
  type DraftStore
} from '$lib/server/bill-drafts.js';
import type { RequestHandler } from './$types';

function jsonBody(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

export function _createFinalizeHandler(store: DraftStore): RequestHandler {
  return async ({ params, request }) => {
    try {
      assertDraftKey(params.draftKey);
      let body: Record<string, unknown>;
      try {
        body = await request.json() as Record<string, unknown>;
      } catch {
        throw new DraftValidationError('Malformed JSON');
      }
      if (!Number.isInteger(body.expectedRevision) || (body.expectedRevision as number) < 1) {
        throw new DraftValidationError('expectedRevision must be a positive integer');
      }
      return jsonBody(store.finalizeDraft({
        draftKey: params.draftKey,
        expectedRevision: body.expectedRevision as number
      }));
    } catch (error) {
      if (error instanceof DraftConflictError) {
        return jsonBody({ error: 'conflict', serverRevision: error.serverRevision }, 409);
      }
      if (error instanceof DraftNotFoundError) return jsonBody({ error: 'not_found' }, 404);
      if (error instanceof DraftValidationError) {
        const numberConflict = Boolean(error.fields.requestedBillNumber && error.latestSuggestedNumber);
        return jsonBody({
          error: 'validation',
          message: error.message,
          fields: error.fields,
          latestSuggestedNumber: error.latestSuggestedNumber
        }, numberConflict ? 409 : 400);
      }
      console.error('Bill draft finalization failed', {
        draftKey: params.draftKey,
        operation: 'finalize',
        error: error instanceof Error ? error.name : 'UnknownError'
      });
      return jsonBody({ error: 'server_error' }, 500);
    }
  };
}

export const POST = _createFinalizeHandler(draftStore);
