'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDemoCredentials } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { parseLoginInput } from '@/lib/validators/m1';

export interface AuthActionState {
  error: string | null;
}

export async function signInWithDemoAction(
  _prevState: AuthActionState
): Promise<AuthActionState> {
  let credentials: { email: string; password: string };
  try {
    credentials = getDemoCredentials();
  } catch {
    return {
      error:
        'Demo workspace credentials are not configured on the server yet.',
    };
  }

  let errorMessage: string | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) {
      errorMessage =
        'Could not sign in to the demo workspace. Check server configuration.';
    }
  } catch {
    errorMessage = 'Supabase is not configured on this server yet.';
  }

  if (errorMessage) {
    return { error: errorMessage };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signInWithPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = parseLoginInput(
    formData.get('email'),
    formData.get('password')
  );
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  let errorMessage: string | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      errorMessage = 'Invalid email or password.';
    }
  } catch {
    errorMessage = 'Supabase is not configured on this server yet.';
  }

  if (errorMessage) {
    return { error: errorMessage };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Allow redirecting to /login cleanly if env is absent.
  }
  revalidatePath('/', 'layout');
  redirect('/login');
}
