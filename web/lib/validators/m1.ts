export const MAX_DOCUMENT_TITLE_LENGTH = 200;
export const MAX_DOCUMENT_CONTENT_LENGTH = 6000;

const PROTECTED_PREFIXES = ['/dashboard', '/knowledge', '/documents'] as const;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAuthRoute(pathname: string): boolean {
  return pathname === '/login' || pathname === '/login/';
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function parseLoginInput(
  emailRaw: unknown,
  passwordRaw: unknown
): ValidationResult<{ email: string; password: string }> {
  if (typeof emailRaw !== 'string' || typeof passwordRaw !== 'string') {
    return { ok: false, error: 'Email and password must be valid text.' };
  }

  const email = emailRaw.trim();
  const password = passwordRaw;

  if (!email || !email.includes('@') || email.length > 320) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  if (password.length === 0) {
    return { ok: false, error: 'Enter your password.' };
  }

  return { ok: true, data: { email, password } };
}

export function validateDocumentInput(
  payload: unknown
): ValidationResult<{ title: string; content: string }> {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid request payload.' };
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.title !== 'string' || typeof record.content !== 'string') {
    return {
      ok: false,
      error: 'Both document title and content must be strings.',
    };
  }

  const title = record.title.trim();
  if (title.length === 0) {
    return { ok: false, error: 'Document title is required.' };
  }
  if (title.length > MAX_DOCUMENT_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Document title must be ${MAX_DOCUMENT_TITLE_LENGTH} characters or fewer.`,
    };
  }

  const normalizedContent = record.content.replace(/\r\n/g, '\n');
  if (normalizedContent.trim().length === 0) {
    return { ok: false, error: 'Document content is required.' };
  }
  if (normalizedContent.length > MAX_DOCUMENT_CONTENT_LENGTH) {
    return {
      ok: false,
      error: `Document content exceeds the ${MAX_DOCUMENT_CONTENT_LENGTH.toLocaleString('en-US')}-character limit.`,
    };
  }

  return {
    ok: true,
    data: {
      title,
      content: normalizedContent,
    },
  };
}

