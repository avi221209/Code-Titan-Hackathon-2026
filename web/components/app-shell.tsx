import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/knowledge', label: 'Knowledge' },
  { href: '/documents/new', label: 'New Review' },
  { href: '/login', label: 'Sign in' },
];

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
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
          <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-2">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main
        className={cn(
          'mx-auto w-full max-w-7xl flex-1 px-6 py-8',
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}
