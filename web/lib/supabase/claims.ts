export interface PublicJwk {
  kty: 'RSA' | 'EC' | 'oct' | (string & {});
  key_ops: string[];
  alg?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface ClaimsUser {
  id: string;
  email: string | null;
}

export interface ClaimsAuthLike {
  getClaims(
    jwt?: string,
    options?: {
      jwks?: {
        keys: PublicJwk[];
      };
    }
  ): Promise<{
    data: {
      claims: Record<string, unknown>;
    } | null;
    error: unknown;
  }>;
}

interface JwksCacheEntry {
  keys: PublicJwk[];
  expiresAt: number;
}

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const JWKS_EMPTY_TTL_MS = 5 * 60 * 1000;
const JWKS_FAILURE_BACKOFF_MS = 30 * 1000;
const MAX_CACHED_ORIGINS = 8;

const jwksCache = new Map<string, JwksCacheEntry>();
const inFlightJwks = new Map<string, Promise<PublicJwk[]>>();

function normalizeJwkList(rawKeys: unknown): PublicJwk[] {
  if (!Array.isArray(rawKeys)) return [];
  const out: PublicJwk[] = [];
  for (const item of rawKeys) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.kty !== 'string' || obj.kty.length === 0) continue;
    const normalized: PublicJwk = {
      ...obj,
      kty: obj.kty,
      key_ops: Array.isArray(obj.key_ops)
        ? obj.key_ops.filter((v): v is string => typeof v === 'string')
        : [],
      ...(typeof obj.alg === 'string' ? { alg: obj.alg } : {}),
      ...(typeof obj.kid === 'string' ? { kid: obj.kid } : {}),
    };
    out.push(normalized);
  }
  return out;
}

function setBoundedCache(origin: string, entry: JwksCacheEntry) {
  if (jwksCache.size >= MAX_CACHED_ORIGINS && !jwksCache.has(origin)) {
    const oldestKey = jwksCache.keys().next().value;
    if (oldestKey !== undefined) {
      jwksCache.delete(oldestKey);
    }
  }
  jwksCache.set(origin, entry);
}

export function clearJwksCacheForTests() {
  jwksCache.clear();
  inFlightJwks.clear();
}

export async function getCachedPublicJwks(
  supabaseUrl: string | undefined,
  anonKey: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<{ keys: PublicJwk[] } | undefined> {
  if (!supabaseUrl || !anonKey) return undefined;
  const origin = supabaseUrl.trim().replace(/\/+$/, '');
  if (!origin) return undefined;

  const now = Date.now();
  const cached = jwksCache.get(origin);
  if (cached && cached.expiresAt > now) {
    return cached.keys.length > 0 ? { keys: cached.keys } : undefined;
  }

  let pending = inFlightJwks.get(origin);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetchImpl(`${origin}/auth/v1/.well-known/jwks.json`, {
          method: 'GET',
          headers: { apikey: anonKey },
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) {
          setBoundedCache(origin, {
            keys: [],
            expiresAt: Date.now() + JWKS_FAILURE_BACKOFF_MS,
          });
          return [];
        }
        const payload = (await res.json().catch(() => null)) as {
          keys?: unknown;
        } | null;
        const keys = normalizeJwkList(payload?.keys);
        setBoundedCache(origin, {
          keys,
          expiresAt:
            Date.now() + (keys.length > 0 ? JWKS_CACHE_TTL_MS : JWKS_EMPTY_TTL_MS),
        });
        return keys;
      } catch {
        setBoundedCache(origin, {
          keys: [],
          expiresAt: Date.now() + JWKS_FAILURE_BACKOFF_MS,
        });
        return [];
      } finally {
        inFlightJwks.delete(origin);
      }
    })();
    inFlightJwks.set(origin, pending);
  }

  const keys = await pending;
  return keys.length > 0 ? { keys } : undefined;
}

export async function getVerifiedClaimsUser(input: {
  auth: ClaimsAuthLike;
  jwks?: { keys: PublicJwk[] };
}): Promise<ClaimsUser | null> {
  try {
    const { data, error } = await input.auth.getClaims(
      undefined,
      input.jwks ? { jwks: input.jwks } : undefined
    );
    if (error || !data?.claims) {
      return null;
    }
    const claims = data.claims;
    const id =
      typeof claims.sub === 'string' && claims.sub.length > 0
        ? claims.sub
        : null;
    if (!id) {
      return null;
    }
    const email =
      typeof claims.email === 'string' && claims.email.length > 0
        ? claims.email
        : null;
    return { id, email };
  } catch {
    return null;
  }
}

