import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { analyze, createReview } from './engine';
import { seedInput } from './seed';
import type { Review } from './types';
import { decodeStoredReview, encodeStoredReview } from './stored-review';

type StoredReview = { data: string };

let db: DatabaseSync | undefined;

export class ReviewNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super('Review not found');
    this.name = 'ReviewNotFoundError';
  }
}

function database(): DatabaseSync {
  if (db) return db;

  const filename =
    process.env.CHAINPATCH_DB ||
    path.join(process.cwd(), '.data', 'chainpatch.sqlite');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const connection = new DatabaseSync(filename);

  try {
    connection.exec('PRAGMA busy_timeout = 5000');
    connection.exec('PRAGMA journal_mode = WAL');
    connection.exec(
      'CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
    );

    const seed = createReview(seedInput, analyze(seedInput, true), 'demo');
    connection
      .prepare('INSERT OR IGNORE INTO reviews (id, data) VALUES (?, ?)')
      .run(seed.id, encodeStoredReview(seed));
    db = connection;
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

function parseReview(data: string): Review {
  return decodeStoredReview(data);
}

export function listReviews(): Review[] {
  const rows = database()
    .prepare('SELECT data FROM reviews ORDER BY rowid DESC')
    .all() as unknown as StoredReview[];
  return rows.map((row) => parseReview(row.data));
}

export function getReview(id: string): Review | undefined {
  const row = database()
    .prepare('SELECT data FROM reviews WHERE id = ?')
    .get(id) as unknown as StoredReview | undefined;
  return row ? parseReview(row.data) : undefined;
}

export function saveReview(review: Review): Review {
  const data = encodeStoredReview(review);
  database()
    .prepare(
      'INSERT INTO reviews (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
    )
    .run(review.id, data);
  return review;
}

export function updateReview(
  id: string,
  update: (review: Review) => Review,
): Review {
  const connection = database();
  let transactionStarted = false;

  try {
    // Serializes read/modify/write operations across local processes while WAL
    // keeps ordinary readers available. This is intentionally small and local,
    // not a replacement for a multi-user database.
    connection.exec('BEGIN IMMEDIATE');
    transactionStarted = true;

    const review = getReview(id);
    if (!review) throw new ReviewNotFoundError();

    const updated = update(review);
    if (updated.id !== id) {
      throw new Error('A review update cannot change its identity');
    }
    const result = saveReview(updated);
    connection.exec('COMMIT');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        connection.exec('ROLLBACK');
      } catch {
        // Preserve the original error. SQLite has already closed the failed
        // transaction in some error cases.
      }
    }
    throw error;
  }
}
