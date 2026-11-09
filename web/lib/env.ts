export interface PublicEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
}

export interface ServerEnv extends PublicEnv {
  SUPABASE_SERVICE_ROLE_KEY: string;
  AI_SERVICE_URL: string;
  AI_SERVICE_TOKEN: string;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() must only be called in server contexts.');
  }

  return {
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: requireEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    AI_SERVICE_URL: requireEnv('AI_SERVICE_URL', process.env.AI_SERVICE_URL),
    AI_SERVICE_TOKEN: requireEnv(
      'AI_SERVICE_TOKEN',
      process.env.AI_SERVICE_TOKEN
    ),
  };
}
