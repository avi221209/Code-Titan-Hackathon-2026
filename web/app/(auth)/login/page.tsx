import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            Sign in to BrandGuardian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Authenticates workspace members via Supabase SSR and provides one-click access to the synthetic Asterra demo workspace (Coming in M1).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
