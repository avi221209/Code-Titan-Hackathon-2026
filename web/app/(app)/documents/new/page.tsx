import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewDocumentPage() {
  return (
    <section className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            Submit Content for Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Accepts draft content up to 6,000 characters or loads the synthetic Asterra sample to trigger a compliance review run (Coming in M2).
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
