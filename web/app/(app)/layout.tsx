import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getWorkspaceContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function AppGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ctx = await getWorkspaceContext();
  if (!ctx.user) {
    redirect('/login');
  }

  return (
    <AppShell
      userEmail={ctx.user.email}
      workspaceName={ctx.workspace?.workspaceName}
      workspaceRole={ctx.workspace?.role}
    >
      {children}
    </AppShell>
  );
}
