import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type WorkspaceRole = 'creator' | 'manager' | 'approver' | 'admin';

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}

export interface WorkspaceContext {
  user: {
    id: string;
    email: string | null;
  } | null;
  workspace: WorkspaceMembership | null;
  queryError: string | null;
}

interface WorkspaceRelationRow {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
}

export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      user: null,
      workspace: null,
      queryError: 'Supabase environment variables are not configured.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, workspace: null, queryError: null };
  }

  const { data, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name)')
    .eq('user_id', user.id)
    .order('workspace_id', { ascending: true })
    .limit(1);

  if (membershipError) {
    return {
      user: { id: user.id, email: user.email ?? null },
      workspace: null,
      queryError: 'Unable to load workspace membership.',
    };
  }

  const row = (data?.[0] as WorkspaceRelationRow | undefined) ?? undefined;
  if (!row) {
    return {
      user: { id: user.id, email: user.email ?? null },
      workspace: null,
      queryError: null,
    };
  }

  const relatedWorkspace = Array.isArray(row.workspaces)
    ? row.workspaces[0]
    : row.workspaces;

  return {
    user: { id: user.id, email: user.email ?? null },
    workspace: {
      workspaceId: row.workspace_id,
      workspaceName: relatedWorkspace?.name ?? 'Assigned workspace',
      role: row.role,
    },
    queryError: null,
  };
});

