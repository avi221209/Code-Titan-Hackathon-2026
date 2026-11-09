import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <section className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            Workspace Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Lists the active workspace, approved knowledge counts, and recent documents awaiting or completing review (Coming in M1).
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
