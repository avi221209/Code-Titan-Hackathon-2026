import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DocumentDetailPage() {
  return (
    <section className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            Document Review Workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Displays highlighted document spans alongside evidence-backed findings, AI status, and human review decision controls (Coming in M2 and M3).
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
