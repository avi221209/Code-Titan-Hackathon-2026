'use client';

import * as React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  signInWithDemoAction,
  signInWithPasswordAction,
  type AuthActionState,
} from '@/app/(auth)/login/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INITIAL_STATE: AuthActionState = { error: null };

export function LoginForms({ configWarning }: { configWarning?: string }) {
  const [demoState, demoFormAction, isDemoPending] = React.useActionState(
    signInWithDemoAction,
    INITIAL_STATE
  );
  const [passwordState, passwordFormAction, isPasswordPending] =
    React.useActionState(signInWithPasswordAction, INITIAL_STATE);

  const isBusy = isDemoPending || isPasswordPending;

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-start">
      <section aria-labelledby="login-heading" className="flex flex-col gap-6 pt-2">
        <div className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          <span>Brand Compliance Desk</span>
        </div>

        <div className="flex flex-col gap-3">
          <h1
            id="login-heading"
            className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            BrandGuardian
          </h1>
          <p className="max-w-[52ch] text-base leading-relaxed text-muted-foreground">
            Review draft copy against approved guidelines, verified facts, and controlled terminology with strict workspace isolation.
          </p>
          {configWarning ? (
            <p
              role="alert"
              className="rounded-md border border-severity-medium-border bg-severity-medium-bg px-3 py-2 text-xs text-severity-medium-fg"
            >
              {configWarning}
            </p>
          ) : null}
        </div>

        <div className="border-t border-border pt-6">
          <p className="mb-3 text-sm font-medium text-foreground">
            Judge &amp; reviewer quick access
          </p>
          <form action={demoFormAction} className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={isBusy}
              aria-busy={isDemoPending}
              className="w-full justify-between sm:w-fit sm:min-w-[240px]"
            >
              <span>
                {isDemoPending
                  ? 'Entering demo workspace…'
                  : 'Enter demo workspace'}
              </span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>

            {demoState.error ? (
              <p
                role="alert"
                className="rounded-md border border-severity-critical-border bg-severity-critical-bg px-3 py-2 text-sm text-severity-critical-fg"
              >
                {demoState.error}
              </p>
            ) : null}
          </form>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Signs into the fictional <span className="font-medium text-foreground">Asterra</span> workspace using synthetic demo data configured server-side.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="credentials-heading"
        className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <div className="mb-6 flex flex-col gap-1">
          <h2
            id="credentials-heading"
            className="font-serif text-xl font-semibold tracking-tight text-foreground"
          >
            Sign in with email
          </h2>
          <p className="text-sm text-muted-foreground">
            Access your assigned workspace with Supabase credentials.
          </p>
        </div>

        <form action={passwordFormAction} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              required
              disabled={isBusy}
              aria-invalid={Boolean(passwordState.error)}
              aria-describedby={
                passwordState.error ? 'login-form-error' : undefined
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isBusy}
              aria-invalid={Boolean(passwordState.error)}
              aria-describedby={
                passwordState.error ? 'login-form-error' : undefined
              }
            />
          </div>

          {passwordState.error ? (
            <p
              id="login-form-error"
              role="alert"
              className="rounded-md border border-severity-critical-border bg-severity-critical-bg px-3 py-2 text-sm text-severity-critical-fg"
            >
              {passwordState.error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="outline"
            disabled={isBusy}
            aria-busy={isPasswordPending}
            className="w-full"
          >
            {isPasswordPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </section>
    </div>
  );
}

