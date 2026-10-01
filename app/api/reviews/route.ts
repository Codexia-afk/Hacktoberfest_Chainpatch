import { NextResponse } from 'next/server';
import { analyzeWithGemma } from '@/lib/model';
import { body, fail, sameOrigin } from '@/lib/http';
import { createReview } from '@/lib/engine';
import { listReviews, saveReview } from '@/lib/store';
import { reviewInput } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(listReviews());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = reviewInput.parse(await body(request));
    const analysis = await analyzeWithGemma(input);
    return NextResponse.json(saveReview(createReview(input, analysis)), {
      status: 201,
    });
  } catch (error) {
    return fail(error);
  }
}
