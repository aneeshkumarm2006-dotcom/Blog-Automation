import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";

export default function Home() {
  return (
    <AppShell >
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-fg-muted">
          Design system
        </p>
        <h1 className="font-serif text-3xl font-semibold text-fg">
          BlogForge — Technical Editorial theme
        </h1>
        <p className="mt-2 max-w-prose text-sm text-fg-muted">
          Temporary smoke surface for Stage 1 design-system foundation.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardDescription>Primary, secondary, ghost, danger.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Geist body, focus ring in primary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="https://example.com" />
            <Input type="number" defaultValue={1500} step={250} />
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button size="sm">Save</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
            <CardDescription>Status pills.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="optimized">Optimized</Badge>
            <Badge variant="warning">Humanization skipped</Badge>
            <Badge variant="error">Failed</Badge>
            <Badge variant="neutral">Queued</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>Primary fill on surface-high track.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={20} label="20%" />
            <Progress value={60} label="60%" />
            <Progress value={92} label="92%" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
