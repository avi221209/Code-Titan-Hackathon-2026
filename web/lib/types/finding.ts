export type Category =
  | 'tone'
  | 'terminology'
  | 'fact'
  | 'unsupported_claim'
  | 'messaging';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type VerificationStatus = 'verified' | 'unverified';

export type FindingOrigin = 'deterministic' | 'llm';

export type AiStatus = 'ok' | 'unavailable' | 'invalid_output' | 'skipped';

/**
 * Mirrors Pydantic Finding in ai-service/main.py 1:1.
 */
export interface Finding {
  category: Category;
  severity: Severity;
  matched_text: string;
  start_offset: number;
  end_offset: number;
  explanation: string;
  source_type: string | null;
  source_id: string | null;
  confidence: number;
  verification_status: VerificationStatus;
  origin: FindingOrigin;
  suggested_text: string | null;
}

/**
 * Mirrors Pydantic ReviewResponse in ai-service/main.py 1:1.
 */
export interface ReviewResponse {
  document_id: string;
  model_name: string;
  ai_status: AiStatus;
  ai_detail: string | null;
  findings: Finding[];
  dropped: number;
  elapsed_ms: number;
}
