import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DocumentHistoryPage() {
  return (
    <section className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            Document Audit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Displays the chronological audit timeline of review runs, human decisions, and actor events for this document (Coming in M3).
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
