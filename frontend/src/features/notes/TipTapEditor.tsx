import { useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Superscript from '@tiptap/extension-superscript';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Box, ToggleButton, ToggleButtonGroup, Divider, alpha } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import TurndownService from 'turndown';
import { marked } from 'marked';

interface TipTapEditorProps {
  content: string; // Markdown content
  onChange: (content: string) => void; // Returns Markdown
}

// Initialize turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Add rules for superscript (citations)
turndownService.addRule('superscript', {
  filter: ['sup'],
  replacement: function (content) {
    return `^${content}^`;
  },
});

// Configure marked for Markdown to HTML conversion
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Convert markdown to HTML for the editor
function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // Handle superscript citations (^1^, ^2^, etc.)
  const withSuperscripts = markdown.replace(/\^(\d+)\^/g, '<sup>$1</sup>');
  
  // Parse markdown to HTML
  const html = marked.parse(withSuperscripts) as string;
  return html;
}

// Convert HTML to Markdown for storage
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndownService.turndown(html);
}

export function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  // Convert initial markdown content to HTML
  const initialHtml = useMemo(() => markdownToHtml(content), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Superscript,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your notes...',
      }),
    ],
    content: initialHtml,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
  });

  // Update editor content when the prop changes (e.g., after regeneration)
  useEffect(() => {
    if (editor && content) {
      const currentHtml = editor.getHTML();
      const newHtml = markdownToHtml(content);
      
      // Only update if content actually changed (avoid cursor jumping)
      if (htmlToMarkdown(currentHtml) !== content) {
        editor.commands.setContent(newHtml);
      }
    }
  }, [content, editor]);

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleCode = useCallback(() => {
    editor?.chain().focus().toggleCode().run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const toggleBlockquote = useCallback(() => {
    editor?.chain().focus().toggleBlockquote().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {/* History */}
        <ToggleButtonGroup size="small">
          <ToggleButton
            value="undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <UndoIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <RedoIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Headings */}
        <ToggleButtonGroup size="small" exclusive>
          <ToggleButton
            value="h1"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            selected={editor.isActive('heading', { level: 1 })}
          >
            H1
          </ToggleButton>
          <ToggleButton
            value="h2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            selected={editor.isActive('heading', { level: 2 })}
          >
            H2
          </ToggleButton>
          <ToggleButton
            value="h3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            selected={editor.isActive('heading', { level: 3 })}
          >
            H3
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Formatting */}
        <ToggleButtonGroup size="small">
          <ToggleButton
            value="bold"
            onClick={toggleBold}
            selected={editor.isActive('bold')}
          >
            <FormatBoldIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="italic"
            onClick={toggleItalic}
            selected={editor.isActive('italic')}
          >
            <FormatItalicIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="code"
            onClick={toggleCode}
            selected={editor.isActive('code')}
          >
            <CodeIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Lists */}
        <ToggleButtonGroup size="small">
          <ToggleButton
            value="bulletList"
            onClick={toggleBulletList}
            selected={editor.isActive('bulletList')}
          >
            <FormatListBulletedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="orderedList"
            onClick={toggleOrderedList}
            selected={editor.isActive('orderedList')}
          >
            <FormatListNumberedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="blockquote"
            onClick={toggleBlockquote}
            selected={editor.isActive('blockquote')}
          >
            <FormatQuoteIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Editor Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 3,
          py: 2,
          '& .ProseMirror': {
            minHeight: '100%',
            outline: 'none',
            '& h1': {
              fontSize: '2rem',
              fontWeight: 700,
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
              lineHeight: 1.2,
            },
            '& h2': {
              fontSize: '1.5rem',
              fontWeight: 600,
              marginTop: '1.25rem',
              marginBottom: '0.5rem',
              lineHeight: 1.3,
            },
            '& h3': {
              fontSize: '1.25rem',
              fontWeight: 600,
              marginTop: '1rem',
              marginBottom: '0.5rem',
              lineHeight: 1.4,
            },
            '& p': {
              lineHeight: 1.8,
              marginBottom: '0.75rem',
            },
            '& ul, & ol': {
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
            },
            '& li': {
              marginBottom: '0.25rem',
            },
            '& blockquote': {
              borderLeft: '4px solid',
              borderColor: 'primary.main',
              paddingLeft: '1rem',
              marginLeft: 0,
              fontStyle: 'italic',
              color: 'text.secondary',
            },
            '& code': {
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.9em',
            },
            '& pre': {
              bgcolor: (theme) => alpha(theme.palette.common.black, 0.05),
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              '& code': {
                bgcolor: 'transparent',
                px: 0,
                py: 0,
              },
            },
            '& sup': {
              color: 'primary.main',
              fontWeight: 600,
              fontSize: '0.75em',
              verticalAlign: 'super',
            },
            '& a': {
              color: 'primary.main',
              textDecoration: 'underline',
            },
            '& hr': {
              border: 'none',
              borderTop: '1px solid',
              borderColor: 'divider',
              margin: '1.5rem 0',
            },
            '& .ProseMirror-placeholder': {
              color: 'text.disabled',
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
