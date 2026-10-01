import { modelStatus } from '@/lib/model';
import { fail } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await modelStatus());
  } catch (error) {
    return fail(error);
  }
}
