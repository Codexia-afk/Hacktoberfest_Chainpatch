import { NextResponse } from 'next/server';
import { analyzeWithGemma } from '@/lib/model';
import { fail, HttpError, sameOrigin } from '@/lib/http';
import { getReview, ReviewNotFoundError, updateReview } from '@/lib/store';

type Context = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const review = getReview(id);
    return review
      ? NextResponse.json(review)
      : NextResponse.json({ error: 'Review not found' }, { status: 404 });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { id } = await context.params;
    const review = getReview(id);
    if (!review) throw new ReviewNotFoundError();

    // Only send the original input to the model. In particular, do not include
    // old replay traces in the prompt or let them become part of new evidence.
    const input = {
      title: review.title,
      current: review.current,
      proposed: review.proposed,
      installed: review.installed,
    };
    const expectedState = JSON.stringify(review);
    const analysis = await analyzeWithGemma(input, id === 'demo');

    return NextResponse.json(
      updateReview(id, (current) => {
        if (JSON.stringify(current) !== expectedState) {
          throw new HttpError(
            409,
            'This review changed while analysis was running. Run the analysis again.',
          );
        }
        return { ...current, analysis, runs: [] };
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { id } = await context.params;
    return NextResponse.json(
      updateReview(id, (review) => ({ ...review, policy: null, runs: [] })),
    );
  } catch (error) {
    return fail(error);
  }
}
