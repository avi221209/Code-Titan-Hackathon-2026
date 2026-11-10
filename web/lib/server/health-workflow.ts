export interface HealthCheckEnvLike {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  AI_SERVICE_URL?: string;
  AI_SERVICE_TOKEN?: string;
}

function hasValue(v: string | undefined): boolean {
  return Boolean(v && v.trim().length > 0);
}

export async function executeHealthCheck(input: {
  env: HealthCheckEnvLike;
  probeUpstream?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const supabaseConfigured =
    hasValue(input.env.NEXT_PUBLIC_SUPABASE_URL) &&
    hasValue(input.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const aiServiceConfigured =
    hasValue(input.env.AI_SERVICE_URL) &&
    hasValue(input.env.AI_SERVICE_TOKEN) &&
    hasValue(input.env.SUPABASE_SERVICE_ROLE_KEY);

  let upstreamReady: boolean | undefined;

  if (input.probeUpstream) {
    if (!hasValue(input.env.AI_SERVICE_URL)) {
      upstreamReady = false;
    } else {
      const fetchFn = input.fetchImpl ?? fetch;
      try {
        const readyUrl = new URL(
          '/ready',
          input.env.AI_SERVICE_URL!.trim()
        ).toString();
        const res = await fetchFn(readyUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(2500),
          cache: 'no-store',
        });
        upstreamReady = res.ok;
      } catch {
        upstreamReady = false;
      }
    }
  }

  const allHealthy = input.probeUpstream
    ? supabaseConfigured && aiServiceConfigured && upstreamReady === true
    : supabaseConfigured && aiServiceConfigured;

  const statusCode = input.probeUpstream ? (allHealthy ? 200 : 503) : 200;

  return {
    status: statusCode,
    body: {
      status: allHealthy ? 'ok' : 'degraded',
      service: 'brandguardian-web',
      timestamp: new Date().toISOString(),
      supabase_configured: supabaseConfigured,
      ai_service_configured: aiServiceConfigured,
      ...(upstreamReady !== undefined ? { upstream_ready: upstreamReady } : {}),
    },
  };
}

