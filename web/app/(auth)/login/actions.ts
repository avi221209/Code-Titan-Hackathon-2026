'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDemoCredentials } from '@/lib/env';
import { defaultLogger } from '@/lib/server/logger';
import { authRateLimiter } from '@/lib/server/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { parseLoginInput } from '@/lib/validators/m1';

export interface AuthActionState {
  error: string | null;
}

async function resolveClientRateLimitKey(scope: string): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = h.get('x-real-ip')?.trim();
    return `${scope}:${forwarded || realIp || 'local'}`;
  } catch {
    return `${scope}:local`;
  }
}

export async function signInWithDemoAction(
  _prevState: AuthActionState
): Promise<AuthActionState> {
  void _prevState;
  const rate = authRateLimiter.check(
    await resolveClientRateLimitKey('auth-demo')
  );
  if (!rate.allowed) {
    defaultLogger.warn('auth.demo_rate_limited', {
      retryAfterSeconds: rate.retryAfterSeconds,
    });
    return {
      error: 'Too many sign-in attempts. Please wait a moment and try again.',
    };
  }

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
      defaultLogger.warn('auth.demo_signin_failed', {
        status: error.status ?? null,
      });
      errorMessage =
        'Could not sign in to the demo workspace. Check server configuration.';
    }
  } catch (err) {
    defaultLogger.error('auth.demo_signin_exception', { err });
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
  void _prevState;
  const rate = authRateLimiter.check(
    await resolveClientRateLimitKey('auth-password')
  );
  if (!rate.allowed) {
    defaultLogger.warn('auth.password_rate_limited', {
      retryAfterSeconds: rate.retryAfterSeconds,
    });
    return {
      error: 'Too many sign-in attempts. Please wait a moment and try again.',
    };
  }

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
      defaultLogger.warn('auth.password_signin_failed', {
        status: error.status ?? null,
      });
      errorMessage = 'Invalid email or password.';
    }
  } catch (err) {
    defaultLogger.error('auth.password_signin_exception', { err });
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
