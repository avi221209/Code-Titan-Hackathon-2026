import { NextResponse } from 'next/server';
import { executeDecisionWorkflow } from '@/lib/server/decision-workflow';
import { createClient } from '@/lib/supabase/server';

function isSupabasePublicConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const configured = isSupabasePublicConfigured();
  if (!configured) {
    return NextResponse.json(
      { error: 'Supabase environment variables are not configured.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { id: suggestionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const result = await executeDecisionWorkflow({
    isSupabaseConfigured: configured,
    suggestionId,
    body,
    supabase,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
