import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, Heading3, List, ListOrdered } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { toEditableHtml } from '../lib/rich-text';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
    ],
    content: toEditableHtml(value),
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          'min-h-[380px] px-3 py-3 text-sm leading-relaxed focus:outline-none ' +
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2',
      },
    },
  });

  if (!editor) return null;

  const toolbarButtons: Array<{
    icon: typeof Bold;
    label: string;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      icon: Bold,
      label: 'Negrito',
      active: editor.isActive('bold'),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: 'Itálico',
      active: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: UnderlineIcon,
      label: 'Sublinhado',
      active: editor.isActive('underline'),
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      icon: Heading3,
      label: 'Título',
      active: editor.isActive('heading', { level: 3 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      icon: List,
      label: 'Lista',
      active: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: 'Lista numerada',
      active: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
      <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        {toolbarButtons.map(({ icon: Icon, label, active, onClick }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon-sm"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={cn(active && 'bg-primary/10 text-primary')}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
