import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForms } from '@/components/login-forms';
import { SkipLink } from '@/components/skip-link';
import {
  getCachedPublicJwks,
  getVerifiedClaimsUser,
} from '@/lib/supabase/claims';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default async function LoginPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseConfigured = Boolean(url && anonKey);

  if (supabaseConfigured) {
    const [supabase, jwks] = await Promise.all([
      createClient(),
      getCachedPublicJwks(url, anonKey),
    ]);
    const user = await getVerifiedClaimsUser({
      auth: supabase.auth,
      jwks,
    });

    if (user) {
      redirect('/dashboard');
    }
  }

  return (
    <>
      <SkipLink />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex min-h-[100dvh] w-full max-w-6xl items-center px-6 py-12 focus:outline-none"
      >
        <LoginForms
          configWarning={
            supabaseConfigured
              ? undefined
              : 'Supabase environment variables are not configured on this server yet.'
          }
        />
      </main>
    </>
  );
}
