import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import TextStyle from '@tiptap/extension-text-style';
import FontSize from './FontSizeExtension';

/**
 * Tiptap-basierter Rich-Text-Editor fuer Reise-/Servicebericht-Notizen.
 * Liefert sauberes HTML, das im Backend (bleach) bereinigt wird.
 *
 * Props:
 *   - value: HTML-String (kann leer sein)
 *   - onChange(html): Callback mit aktuellem HTML
 *   - placeholder: Hinweistext
 *   - minHeight: Mindeshoehe in px (Default 160)
 */
const FONT_FAMILIES = [
  { label: 'Standard', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
];

const FONT_SIZES = [
  { label: 'Standard', value: '' },
  { label: 'Klein (12)', value: '12px' },
  { label: 'Normal (14)', value: '14px' },
  { label: 'Mittel (16)', value: '16px' },
  { label: 'Gross (18)', value: '18px' },
  { label: 'Sehr gross (22)', value: '22px' },
  { label: 'Ueberschrift (28)', value: '28px' },
];

/**
 * ToolbarButton mit onMouseDown.preventDefault(), damit der Editor
 * beim Klick nicht den Fokus verliert (wichtig fuer Heading/Listen).
 */
const ToolbarButton = ({ active, onClick, disabled, title, children }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-pressed={active ? 'true' : 'false'}
    className={
      'px-2 py-1 text-sm rounded border transition-colors ' +
      (active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100') +
      (disabled ? ' opacity-50 cursor-not-allowed' : '')
    }
  >
    {children}
  </button>
);

/**
 * Lokales Stylesheet fuer den Tiptap-Editor-Bereich.
 * Da das Projekt kein @tailwindcss/typography-Plugin nutzt,
 * muessen wir die Tiptap-Ausgabe selbst stylen, damit der User
 * die Formatierungen (fett, kursiv, Listen, Schriftgroesse, ...)
 * SOFORT im Notizenfeld sieht.
 */
const editorStyles = `
  .verp-notes-editor .ProseMirror {
    outline: none;
    min-height: 160px;
    padding: 0.75rem;
    line-height: 1.5;
    color: #111827;
    font-size: 14px;
  }
  .verp-notes-editor .ProseMirror p {
    margin: 0 0 0.5rem 0;
  }
  .verp-notes-editor .ProseMirror p:last-child {
    margin-bottom: 0;
  }
  .verp-notes-editor .ProseMirror h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0.75rem 0 0.5rem 0;
    color: #111827;
  }
  .verp-notes-editor .ProseMirror h2 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0.6rem 0 0.4rem 0;
    color: #1f2937;
  }
  .verp-notes-editor .ProseMirror h3 {
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0.5rem 0 0.3rem 0;
    color: #374151;
  }
  .verp-notes-editor .ProseMirror ul,
  .verp-notes-editor .ProseMirror ol {
    margin: 0.5rem 0 0.5rem 1.5rem;
  }
  .verp-notes-editor .ProseMirror ul {
    list-style-type: disc;
  }
  .verp-notes-editor .ProseMirror ol {
    list-style-type: decimal;
  }
  .verp-notes-editor .ProseMirror li {
    margin: 0.15rem 0;
  }
  .verp-notes-editor .ProseMirror b,
  .verp-notes-editor .ProseMirror strong {
    font-weight: 700;
  }
  .verp-notes-editor .ProseMirror i,
  .verp-notes-editor .ProseMirror em {
    font-style: italic;
  }
  .verp-notes-editor .ProseMirror u {
    text-decoration: underline;
  }
  .verp-notes-editor .ProseMirror s {
    text-decoration: line-through;
  }
  .verp-notes-editor .ProseMirror hr {
    border: none;
    border-top: 1px solid #d1d5db;
    margin: 1rem 0;
  }
  /* Inline-styles aus font-size/font-family werden direkt uebertragen,
     daher ist hier kein zusaetzliches CSS noetig. */
  .verp-notes-editor .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
    height: 0;
    float: left;
  }
`;

const NotesEditor = ({ value, onChange, placeholder = 'Notizen eingeben...', minHeight = 160 }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      TextStyle,
      // FontFamily braucht TextStyle als Basis, sonst funktioniert es nicht.
      FontFamily.configure({
        types: ['textStyle'],
      }),
      // Schriftgroesse: eigene Extension, die ein fontSize-Attribut
      // auf einem eigenen Mark registriert (Tiptap v2 hat keine offizielle
      // font-size-Extension; in v3 ist sie als @tiptap/extension-font-size
      // verfuegbar).
      FontSize,
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      if (onChange) onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'verp-notes-content focus:outline-none',
        'data-placeholder': placeholder,
        style: `min-height: ${minHeight}px;`,
      },
    },
  });

  // Wenn sich `value` von aussen aendert (z. B. beim Laden des Berichts),
  // Editor-Inhalt aktualisieren, ohne den Cursor zu verschieben.
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
        Editor wird geladen...
      </div>
    );
  }

  const getCurrentFontSize = () => {
    try {
      const size = editor.getAttributes('fontSize').fontSize;
      return size || '';
    } catch {
      return '';
    }
  };

  const getCurrentFontFamily = () => {
    try {
      const family = editor.getAttributes('textStyle').fontFamily;
      return family || '';
    } catch {
      return '';
    }
  };

  // Dropdown-Handler: KEIN preventDefault() auf den <select>, weil das
  // das Aufklappen verhindert. Stattdessen nach dem Setzen den Fokus
  // zurueck in den Editor bringen.
  const setFontFamily = (val) => {
    if (val) {
      editor.chain().focus().setMark('textStyle', { fontFamily: val }).run();
    } else {
      try {
        editor.chain().focus().unsetFontFamily().run();
      } catch {
        editor.chain().focus().updateMark('textStyle', { fontFamily: null }).run();
      }
    }
    // Fokus zurueck in den Editor, damit der User weiter tippen kann.
    setTimeout(() => editor.commands.focus(), 0);
  };

  const setFontSize = (val) => {
    if (!editor) return;
    if (val) {
      // Eigenes Kommando aus unserer FontSizeExtension.
      if (typeof editor.can().setFontSize === 'function' &&
          editor.can().setFontSize(val)) {
        editor.chain().focus().setFontSize(val).run();
      } else {
        // Fallback (z. B. waehrend Hot-Reload, bevor die Extension geladen ist).
        editor.chain().focus().setMark('textStyle', { fontSize: val }).run();
      }
    } else {
      if (typeof editor.can().unsetFontSize === 'function' &&
          editor.can().unsetFontSize()) {
        editor.chain().focus().unsetFontSize().run();
      } else {
        editor.chain().focus().updateMark('textStyle', { fontSize: null }).run();
      }
    }
    setTimeout(() => editor.commands.focus(), 0);
  };

  return (
    <div className="verp-notes-editor border border-gray-300 rounded-md bg-white">
      {/* Lokales Stylesheet einschleusen */}
      <style dangerouslySetInnerHTML={{ __html: editorStyles }} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-md">
        {/* Schriftart */}
        <select
          value={getCurrentFontFamily()}
          onChange={(e) => setFontFamily(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white cursor-pointer"
          title="Schriftart"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Schriftgroesse */}
        <select
          value={getCurrentFontSize()}
          onChange={(e) => setFontSize(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white cursor-pointer"
          title="Schriftgroesse"
        >
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Ueberschriften */}
        <ToolbarButton
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Ueberschrift 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Ueberschrift 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Ueberschrift 3"
        >
          H3
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Text-Stile */}
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Fett (Strg+B)"
        >
          <b>F</b>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Kursiv (Strg+I)"
        >
          <i>K</i>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Unterstrichen (Strg+U)"
        >
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Durchgestrichen"
        >
          <s>S</s>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Listen */}
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Aufzaehlung"
        >
          &bull; Liste
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Nummerierte Liste"
        >
          1. Liste
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Block & Sonstiges */}
        <ToolbarButton
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Normaler Absatz"
        >
          ¶
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Trennlinie"
        >
          &mdash;
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Rueckgaengig (Strg+Z)"
        >
          &#8630;
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Wiederherstellen (Strg+Y)"
        >
          &#8631;
        </ToolbarButton>
      </div>

      {/* Editor-Bereich */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default NotesEditor;