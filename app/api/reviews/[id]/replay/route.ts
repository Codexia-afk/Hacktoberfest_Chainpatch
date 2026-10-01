import { NextResponse } from 'next/server';
import { z } from 'zod';
import { body, fail, HttpError, sameOrigin } from '@/lib/http';
import { simulate } from '@/lib/engine';
import { updateReview } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };
const replayInput = z.object({
  scenario: z.enum(['before', 'after', 'fixed']),
  task: z.enum(['unsafe-probe', 'legitimate']).default('unsafe-probe'),
});

export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { id } = await context.params;
    const data = replayInput.parse(await body(request));

    return NextResponse.json(
      updateReview(id, (review) => {
        if (data.scenario === 'fixed' && !review.policy) {
          throw new HttpError(
            400,
            'Apply a policy before running After Fix.',
          );
        }
        const run = simulate(review, data.scenario, data.task);
        return { ...review, runs: [...review.runs, run].slice(-60) };
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
