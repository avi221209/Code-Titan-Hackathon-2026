import { CheckCircle2, HelpCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FindingOrigin, VerificationStatus } from '@/lib/types/finding';

export interface VerificationBadgeProps {
  verificationStatus: VerificationStatus;
  origin?: FindingOrigin;
  className?: string;
}

export function VerificationBadge({
  verificationStatus,
  origin,
  className,
}: VerificationBadgeProps) {
  const isVerified = verificationStatus === 'verified';

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant={isVerified ? 'default' : 'outline'} className={className}>
        {isVerified ? (
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <HelpCircle className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span>{isVerified ? 'Verified' : 'Unverified'}</span>
      </Badge>
      {origin === 'llm' ? (
        <Badge variant="secondary">
          <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
          <span>AI-generated</span>
        </Badge>
      ) : null}
    </span>
  );
}
