import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForms } from '@/components/login-forms';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default async function LoginPage() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect('/dashboard');
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl items-center px-6 py-12">
      <LoginForms
        configWarning={
          supabaseConfigured
            ? undefined
            : 'Supabase environment variables are not configured on this server yet.'
        }
      />
    </main>
  );
}
