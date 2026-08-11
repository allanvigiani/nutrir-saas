import DOMPurify from 'dompurify';
import { cn } from '../lib/utils';
import { isRichTextHtml } from '../lib/rich-text';

export interface RichTextViewerProps {
  html?: string | null;
  emptyFallback?: string;
  className?: string;
}

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'h3', 'ul', 'ol', 'li'];

export function RichTextViewer({ html, emptyFallback = '', className }: RichTextViewerProps) {
  const content = html?.trim();

  if (!content) {
    return <div className={cn('text-sm text-foreground leading-relaxed', className)}>{emptyFallback}</div>;
  }

  if (!isRichTextHtml(content)) {
    return (
      <div className={cn('text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono', className)}>
        {content}
      </div>
    );
  }

  const sanitized = DOMPurify.sanitize(content, { ALLOWED_TAGS });

  return (
    <div
      className={cn(
        'text-sm text-foreground leading-relaxed ' +
          '[&_strong]:font-semibold [&_u]:underline ' +
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 ' +
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
          '[&_p]:min-h-[1lh]',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
