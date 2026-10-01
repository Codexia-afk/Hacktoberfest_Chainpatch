import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { Review } from './types';

export const MAX_JSON_BODY_BYTES = 60_000;
export const EXPORT_SCHEMA_VERSION = 1;
export const EXPORT_LIMITATIONS =
  'Fictional examples or user-supplied sandbox documents are used in this bounded local simulation; no external publishing occurs. Model suggestions are hypotheses. The simulator exercises a selected path; it does not prove all real-world agent behavior safe. Classification labels are supplied by the fixture or user, not a production DLP classifier; summaries are supplied rather than automatically redacted. Custom reviews outside the supported report/publisher pattern cannot be verified. A blocked summary does not demonstrate that a private-source attack was exercised or blocked.';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function errorStatus(error: unknown): number {
  if (error instanceof ZodError) return 400;
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number' &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }
  return 500;
}

function errorMessage(error: unknown, status: number): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
  }
  if (status >= 400 && status < 500 && error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function fail(error: unknown) {
  const status = errorStatus(error);
  return NextResponse.json({ error: errorMessage(error, status) }, { status });
}

function requestBodyError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof SyntaxError) {
    return new HttpError(400, 'Request body must contain valid JSON.');
  }
  return new HttpError(400, 'Request body must be valid UTF-8 JSON.');
}

export async function body(request: Request): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const normalized = contentLength.trim();
    if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(Number(normalized))) {
      throw new HttpError(400, 'Content-Length must be a valid byte count.');
    }
    if (Number(normalized) > MAX_JSON_BODY_BYTES) {
      throw new HttpError(
        413,
        `Request is too large (${MAX_JSON_BODY_BYTES / 1000} KB maximum).`,
      );
    }
  }

  const contentType = request.headers.get('content-type');
  if (
    contentType &&
    contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json'
  ) {
    throw new HttpError(415, 'Request body must use Content-Type application/json.');
  }

  if (!request.body) {
    throw new HttpError(400, 'A JSON request body is required.');
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(
          413,
          `Request is too large (${MAX_JSON_BODY_BYTES / 1000} KB maximum).`,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw requestBodyError(error);
    }
  } catch (error) {
    throw requestBodyError(error);
  } finally {
    reader.releaseLock();
  }
}

function origin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new HttpError(403, 'Cross-origin changes are not allowed.');
  }
}

export function sameOrigin(request: Request): void {
  // Next can normalize request.url to its listening hostname. The browser's
  // actual destination is the Host header; never trust forwarded host aliases.
  const url = new URL(request.url);
  const host = request.headers.get('host');
  if (host) {
    try {
      const destination = new URL(`${url.protocol}//${host}`);
      if (destination.host !== host || destination.username || destination.password) throw new Error('Invalid host');
      url.host = destination.host;
    } catch {
      throw new HttpError(403, 'Cross-origin changes are not allowed.');
    }
  }
  const requestOrigin = url.origin;
  const requestOriginHeader = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (
    requestOriginHeader &&
    (requestOriginHeader === 'null' ||
      origin(requestOriginHeader) !== requestOrigin)
  ) {
    throw new HttpError(403, 'Cross-origin changes are not allowed.');
  }

  if (referer && origin(referer) !== requestOrigin) {
    throw new HttpError(403, 'Cross-origin changes are not allowed.');
  }
}

export function exportPayload(review: Review) {
  return {
    ...review,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    limitations: EXPORT_LIMITATIONS,
  };
}
