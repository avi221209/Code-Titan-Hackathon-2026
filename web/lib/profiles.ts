import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

interface ProfileRow {
  id: string;
  full_name: string | null;
}

export async function loadProfileNamesMap(
  userIds: readonly (string | null | undefined)[]
): Promise<Record<string, string>> {
  const uniqueIds = Array.from(
    new Set(
      userIds.filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    )
  );

  if (uniqueIds.length === 0) {
    return {};
  }

  const out: Record<string, string> = {};

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueIds);

      for (const row of (data as ProfileRow[] | null) ?? []) {
        if (row.full_name && row.full_name.trim().length > 0) {
          out[row.id] = row.full_name.trim();
        }
      }
      return out;
    } catch {
      // Fall back to user-scoped profiles query below.
    }
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', uniqueIds);

    for (const row of (data as ProfileRow[] | null) ?? []) {
      if (row.full_name && row.full_name.trim().length > 0) {
        out[row.id] = row.full_name.trim();
      }
    }
  } catch {
    // Keep empty fallback map cleanly.
  }

  return out;
}
