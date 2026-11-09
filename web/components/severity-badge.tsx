import {
  AlertOctagon,
  AlertTriangle,
  Info,
  MinusCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Severity } from '@/lib/types/finding';

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  critical: { label: 'Critical', Icon: AlertOctagon },
  high: { label: 'High', Icon: AlertTriangle },
  medium: { label: 'Medium', Icon: Info },
  low: { label: 'Low', Icon: MinusCircle },
};

export interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const { label, Icon } = SEVERITY_CONFIG[severity];

  return (
    <Badge variant={severity} className={className}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );
}
