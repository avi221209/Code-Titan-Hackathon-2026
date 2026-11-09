import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateDocumentInput } from '@/lib/validators/m1';
import { getWorkspaceContext } from '@/lib/workspace';

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase environment variables are not configured.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('documents')
    .select('id, workspace_id, title, status, version, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: 'Unable to fetch documents.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ documents: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase environment variables are not configured.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getWorkspaceContext();
  if (ctx.queryError) {
    return NextResponse.json(
      { error: 'Unable to verify workspace membership.' },
      { status: 500 }
    );
  }
  if (!ctx.workspace) {
    return NextResponse.json(
      { error: 'No active workspace membership found.' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const parsed = validateDocumentInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error: insertError } = await supabase
    .from('documents')
    .insert({
      workspace_id: ctx.workspace.workspaceId,
      created_by: user.id,
      title: parsed.data.title,
      content: parsed.data.content,
      status: 'draft',
    })
    .select('id, title, status, version, created_at')
    .single();

  if (insertError) {
    if (insertError.code === '42501') {
      return NextResponse.json(
        { error: 'You do not have permission to create documents in this workspace.' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to save document.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      id: data.id,
      document: data,
    },
    { status: 201 }
  );
}
