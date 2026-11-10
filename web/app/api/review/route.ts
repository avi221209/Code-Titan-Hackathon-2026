import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { executeReviewWorkflow } from '@/lib/server/review-workflow';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

function isSupabasePublicConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(request: Request) {
  const configured = isSupabasePublicConfigured();
  if (!configured) {
    return NextResponse.json(
      { error: 'Supabase environment variables are not configured.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const result = await executeReviewWorkflow({
    isSupabaseConfigured: configured,
    body,
    supabase,
    getServerEnv,
    createAdminClient,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
