import 'server-only';
import { cache } from 'react';
import {
  getCachedPublicJwks,
  getVerifiedClaimsUser,
} from '@/lib/supabase/claims';
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      user: null,
      workspace: null,
      queryError: 'Supabase environment variables are not configured.',
    };
  }

  const [supabase, jwks] = await Promise.all([
    createClient(),
    getCachedPublicJwks(supabaseUrl, anonKey),
  ]);
  const user = await getVerifiedClaimsUser({
    auth: supabase.auth,
    jwks,
  });

  if (!user) {
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

