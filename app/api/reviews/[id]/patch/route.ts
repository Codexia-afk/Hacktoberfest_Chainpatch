import { NextResponse } from 'next/server';
import { body, fail, HttpError, sameOrigin } from '@/lib/http';
import { evaluatePatch } from '@/lib/engine';
import { updateReview } from '@/lib/store';
import { policySchema } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { id } = await context.params;
    const policy = policySchema.parse(await body(request));

    return NextResponse.json(
      updateReview(id, (review) => {
        if (!review.analysis.supported) {
          throw new HttpError(
            400,
            'This review is outside the supported simulation pattern.',
          );
        }
        const { unsafe, legitimate } = evaluatePatch(review, policy);
        return {
          ...review,
          policy,
          runs: [...review.runs, unsafe, legitimate].slice(-60),
        };
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
