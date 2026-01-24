import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your notes...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

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
            onClick={() => editor.chain().focus().toggleBold().run()}
            selected={editor.isActive('bold')}
          >
            <FormatBoldIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            selected={editor.isActive('italic')}
          >
            <FormatItalicIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="code"
            onClick={() => editor.chain().focus().toggleCode().run()}
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
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            selected={editor.isActive('bulletList')}
          >
            <FormatListBulletedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="orderedList"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            selected={editor.isActive('orderedList')}
          >
            <FormatListNumberedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="blockquote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
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
              mt: 4,
              mb: 2,
            },
            '& h2': {
              fontSize: '1.5rem',
              fontWeight: 600,
              mt: 3,
              mb: 1.5,
            },
            '& h3': {
              fontSize: '1.25rem',
              fontWeight: 600,
              mt: 2.5,
              mb: 1,
            },
            '& p': {
              lineHeight: 1.8,
              mb: 1.5,
            },
            '& ul, & ol': {
              pl: 3,
              mb: 2,
            },
            '& li': {
              mb: 0.5,
            },
            '& blockquote': {
              borderLeft: 4,
              borderColor: 'primary.main',
              pl: 2,
              ml: 0,
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
