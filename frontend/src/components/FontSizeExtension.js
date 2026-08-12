/**
 * Custom Tiptap v2 Extension: FontSize
 *
 * In Tiptap v2.x gibt es keine offizielle @tiptap/extension-font-size
 * (das existiert erst in v3). Wir registrieren daher ein fontSize-Attribut
 * auf dem textStyle-Mark, sodass der Editor Schriftgroessen wie '16px'
 * versteht und als Inline-Style anwendet.
 *
 * Output-Beispiel: <span style="font-size: 16px;">Text</span>
 */
import { Mark, mergeAttributes } from '@tiptap/core';

export const FontSize = Mark.create({
  name: 'fontSize',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (node) => {
          const el = node;
          const fontSize = el.style && el.style.fontSize;
          return fontSize ? { fontSize } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ commands }) => {
          if (!fontSize) {
            return commands.unsetFontSize();
          }
          return commands.setMark(this.name, { fontSize });
        },
      unsetFontSize:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

export default FontSize;