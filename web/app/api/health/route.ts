import { NextResponse } from 'next/server';
import { executeHealthCheck } from '@/lib/server/health-workflow';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let probeUpstream = false;
  try {
    const url = new URL(request.url);
    const probeParam = url.searchParams.get('probe');
    probeUpstream = probeParam === '1' || probeParam === 'ready';
  } catch {
    probeUpstream = false;
  }

  const result = await executeHealthCheck({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      AI_SERVICE_URL: process.env.AI_SERVICE_URL,
      AI_SERVICE_TOKEN: process.env.AI_SERVICE_TOKEN,
    },
    probeUpstream,
  });

  return NextResponse.json(result.body, { status: result.status });
}
