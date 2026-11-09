import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { signOutAction } from '@/app/(auth)/login/actions';
import { AppNavLinks } from '@/components/app-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WorkspaceRole } from '@/lib/workspace';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  workspaceName?: string | null;
  workspaceRole?: WorkspaceRole | null;
  className?: string;
}

export function AppShell({
  children,
  userEmail,
  workspaceName,
  workspaceRole,
  className,
}: AppShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 font-serif text-lg font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ShieldCheck
                className="size-5 text-primary"
                aria-hidden="true"
              />
              <span>BrandGuardian</span>
            </Link>
            <AppNavLinks />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {workspaceName ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-xs font-medium text-foreground">
                  {workspaceName}
                </span>
                {workspaceRole ? (
                  <Badge variant="secondary" className="capitalize">
                    {workspaceRole}
                  </Badge>
                ) : null}
              </div>
            ) : null}

            {userEmail ? (
              <span className="hidden font-mono text-xs text-muted-foreground lg:inline">
                {userEmail}
              </span>
            ) : null}

            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="size-3.5" aria-hidden="true" />
                <span>Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main
        className={cn(
          'mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6',
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}
