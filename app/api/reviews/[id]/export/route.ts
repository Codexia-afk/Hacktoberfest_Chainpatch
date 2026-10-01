import { markdownReport } from '@/lib/engine';
import {
  evidenceSnapshot,
  solanaProof,
  snowflakeSql,
} from '@/lib/track-integrations';
import {
  exportPayload,
  fail,
  EXPORT_SCHEMA_VERSION,
} from '@/lib/http';
import { getReview } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

function exportFilename(id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'review';
  return `chainpatch-${safeId}`;
}

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const review = getReview(id);
    if (!review) {
      return Response.json({ error: 'Review not found' }, { status: 404 });
    }

    const snapshot = evidenceSnapshot(review);
    const solana = solanaProof(snapshot);
    const snowflake = snowflakeSql(snapshot);
    const markdownFence = '`'.repeat(3);
    const payload = {
      ...exportPayload(review),
      trackArtifacts: {
        solana,
        snowflakeSql: snowflake,
        note:
          'These are local export artifacts. No Solana transaction or Snowflake upload was performed.',
      },
    };
    const markdown =
      markdownReport(review) +
      `\n\n## Export metadata\n\nSchema version: ${EXPORT_SCHEMA_VERSION}\n\n` +
      '## Track-safe artifacts\n\n' +
      `- Solana memo proof: local only; ${solana.evidenceDigest}\n` +
      '- Snowflake: executable SQL export generated locally; not uploaded.\n' +
      `\n### Solana memo payload\n\n${solana.memo}\n\n` +
      '### Snowflake SQL\n\n' +
      `${markdownFence}sql\n${snowflake}\n${markdownFence}\n`;
    const format = new URL(request.url).searchParams.get('format');
    const isMarkdown = format === 'md';
    const isSolana = format === 'solana';
    const isSnowflake = format === 'sql';
    const extension = isMarkdown || isSnowflake ? (isMarkdown ? 'md' : 'sql') : 'json';
    const content = isMarkdown
      ? markdown
      : isSolana
        ? JSON.stringify(solana, null, 2)
        : isSnowflake
          ? snowflake
          : JSON.stringify(payload, null, 2);

    return new Response(content, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': isMarkdown
          ? 'text/markdown; charset=utf-8'
          : isSnowflake
            ? 'application/sql; charset=utf-8'
            : 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFilename(
          review.id,
        )}.${isSolana ? 'json' : extension}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return fail(error);
  }
}
