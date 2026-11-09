import { AlertTriangle, CheckCircle2, Info, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiStatus } from '@/lib/types/finding';

const STATUS_META: Record<
  AiStatus,
  {
    title: string;
    description: string;
    tone: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  ok: {
    title: 'AI review completed',
    description:
      'Deterministic checks and structured language-model checks completed.',
    tone: 'border-primary/30 bg-accent text-foreground',
    Icon: CheckCircle2,
  },
  unavailable: {
    title: 'AI unavailable',
    description:
      'Language model was unreachable. Only deterministic rule, fact, and terminology checks are shown.',
    tone: 'border-severity-high-border bg-severity-high-bg text-severity-high-fg',
    Icon: WifiOff,
  },
  invalid_output: {
    title: 'AI output rejected',
    description:
      'Model output failed schema validation and was discarded. Deterministic findings remain valid.',
    tone: 'border-severity-medium-border bg-severity-medium-bg text-severity-medium-fg',
    Icon: AlertTriangle,
  },
  skipped: {
    title: 'AI check skipped',
    description: 'Review ran with deterministic checkers only.',
    tone: 'border-border bg-muted text-muted-foreground',
    Icon: Info,
  },
};

export interface AiStatusBannerProps {
  aiStatus: AiStatus;
  aiDetail?: string | null;
  modelName?: string;
  className?: string;
}

export function AiStatusBanner({
  aiStatus,
  aiDetail,
  modelName,
  className,
}: AiStatusBannerProps) {
  const { title, description, tone, Icon } = STATUS_META[aiStatus];

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
        tone,
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <span>{title}</span>
          {modelName ? (
            <span className="font-mono text-xs opacity-80">{modelName}</span>
          ) : null}
        </div>
        <p className="text-xs opacity-90">{aiDetail || description}</p>
      </div>
    </div>
  );
}
