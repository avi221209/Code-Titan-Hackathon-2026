import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function KnowledgePage() {
  return (
    <section className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            Approved Brand Knowledge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Displays read-only approved guideline rules, verified facts, and terminology entries with their sources and validity dates (Coming in M1).
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
