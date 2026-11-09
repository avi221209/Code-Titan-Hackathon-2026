'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ASTERRA_SAMPLE_CONTENT,
  ASTERRA_SAMPLE_TITLE,
} from '@/lib/samples/asterra';
import {
  MAX_DOCUMENT_CONTENT_LENGTH,
  MAX_DOCUMENT_TITLE_LENGTH,
  validateDocumentInput,
} from '@/lib/validators/m1';
import { cn } from '@/lib/utils';

export function NewDocumentForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const normalizedLength = content.replace(/\r\n/g, '\n').length;
  const isOverLimit = normalizedLength > MAX_DOCUMENT_CONTENT_LENGTH;

  function handleLoadSample() {
    setTitle(ASTERRA_SAMPLE_TITLE);
    setContent(ASTERRA_SAMPLE_CONTENT);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validated = validateDocumentInput({ title, content });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated.data),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };

      if (!response.ok || !payload.id) {
        setError(payload.error ?? 'Failed to save document. Please try again.');
        setIsSubmitting(false);
        return;
      }

      router.push(`/documents/${payload.id}`);
      router.refresh();
    } catch {
      setError('Network error while saving document. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
      noValidate
    >
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Draft content submission
          </p>
          <p className="text-xs text-muted-foreground">
            Saved under your workspace membership. Maximum{' '}
            {MAX_DOCUMENT_CONTENT_LENGTH.toLocaleString('en-US')} characters.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLoadSample}
          disabled={isSubmitting}
          className="w-fit"
        >
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          <span>Load Asterra sample</span>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="document-title"
          className="text-sm font-medium text-foreground"
        >
          Document title
        </label>
        <Input
          id="document-title"
          name="title"
          value={title}
          maxLength={MAX_DOCUMENT_TITLE_LENGTH}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Q4 Product Announcement"
          required
          disabled={isSubmitting}
          aria-invalid={Boolean(error && title.trim().length === 0)}
          aria-describedby={error ? 'document-form-error' : 'title-help'}
        />
        <p id="title-help" className="text-xs text-muted-foreground">
          Up to {MAX_DOCUMENT_TITLE_LENGTH} characters.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor="document-content"
            className="text-sm font-medium text-foreground"
          >
            Draft copy
          </label>
          <span
            id="content-char-counter"
            aria-live="polite"
            className={cn(
              'font-mono text-xs tabular-nums',
              isOverLimit
                ? 'font-semibold text-severity-critical-fg'
                : 'text-muted-foreground'
            )}
          >
            {normalizedLength.toLocaleString('en-US')} /{' '}
            {MAX_DOCUMENT_CONTENT_LENGTH.toLocaleString('en-US')}
          </span>
        </div>

        <Textarea
          id="document-content"
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          placeholder="Paste marketing or product copy to persist in your workspace..."
          required
          disabled={isSubmitting}
          aria-invalid={
            isOverLimit || Boolean(error && content.trim().length === 0)
          }
          aria-describedby={
            error
              ? 'document-form-error content-char-counter'
              : 'content-char-counter'
          }
          className="min-h-[240px] leading-relaxed"
        />
      </div>

      {error ? (
        <p
          id="document-form-error"
          role="alert"
          className="rounded-md border border-severity-critical-border bg-severity-critical-bg px-3 py-2 text-sm text-severity-critical-fg"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Persists as a draft record; automated compliance review launches in M2.
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full sm:w-auto"
        >
          <FilePlus2 className="size-4" aria-hidden="true" />
          <span>{isSubmitting ? 'Saving document…' : 'Save document'}</span>
        </Button>
      </div>
    </form>
  );
}

