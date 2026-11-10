export type LogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogger {
  info(event: string, meta?: Record<string, unknown>): void;
  warn(event: string, meta?: Record<string, unknown>): void;
  error(event: string, meta?: Record<string, unknown>): void;
}

const SENSITIVE_KEY_PATTERN =
  /token|secret|key|password|authorization|cookie|content|edited_?text|comment|suggested_text|matched_text/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.slice(0, 200),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(key, item));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, childVal] of Object.entries(
      value as Record<string, unknown>
    )) {
      out[childKey] = sanitizeValue(childKey, childVal);
    }
    return out;
  }
  if (typeof value === 'string') {
    return value.slice(0, 300);
  }
  return value;
}

export function sanitizeLogMeta(
  meta: Record<string, unknown> = {}
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    safe[k] = sanitizeValue(k, v);
  }
  return safe;
}

function emitLog(
  level: LogLevel,
  event: string,
  meta: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeLogMeta(meta),
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const defaultLogger: StructuredLogger = {
  info(event, meta) {
    emitLog('info', event, meta);
  },
  warn(event, meta) {
    emitLog('warn', event, meta);
  },
  error(event, meta) {
    emitLog('error', event, meta);
  },
};

