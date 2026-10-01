import { NextResponse } from 'next/server';
import { z } from 'zod';
import { body, fail, sameOrigin } from '@/lib/http';
import { createReview, simulate } from '@/lib/engine';
import { saveReview } from '@/lib/store';
import { narrowPolicy, reviewInput } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  instructions: reviewInput,
  documents: z.object({
    privateSource: z.string().trim().min(1).max(4000),
    approvedSummary: z.string().trim().min(1).max(4000),
  }).strict(),
  policyAction: z.enum(['allow-listed', 'disable', 'require-approval']),
}).strict();

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = inputSchema.parse(await body(request));
    const review = { ...createReview(input.instructions), documents: input.documents };
    // Every presentation owns a fresh review; repeated runs preserve earlier evidence.
    review.runs.push(simulate(review, 'before', 'legitimate'));
    review.runs.push(simulate(review, 'after', 'unsafe-probe'));
    review.policy = { ...narrowPolicy, action: input.policyAction };
    review.runs.push(simulate(review, 'fixed', 'unsafe-probe'));
    review.runs.push(simulate(review, 'fixed', 'legitimate'));
    return NextResponse.json(saveReview(review), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
