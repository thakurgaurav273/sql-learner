import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// One CodeMirror theme for light and dark: every colour is a CSS variable,
// so it follows the app theme automatically.
const base = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'transparent', color: 'var(--foreground)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--primary)' },
  '.cm-line': { padding: '0 16px 0 6px' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'color-mix(in oklab, var(--muted-foreground) 70%, transparent)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 14px', minWidth: '34px', fontSize: '12px' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--foreground)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--primary) 5%, transparent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--primary)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--primary) 22%, transparent) !important',
  },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in oklab, var(--primary) 16%, transparent)', outline: 'none', borderRadius: '2px' },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in oklab, var(--primary) 10%, transparent)' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 10px 30px -10px rgb(0 0 0 / 0.25)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', fontSize: '12.5px', maxHeight: '16em', padding: '4px' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '3px 8px !important', borderRadius: '5px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' },
  '.cm-completionIcon': { opacity: '0.6' },
  '.cm-completionDetail': { color: 'var(--muted-foreground)', fontStyle: 'normal', marginLeft: '8px' },
  '.cm-diagnostic': { padding: '6px 10px', fontFamily: 'var(--font-sans)', fontSize: '12.5px' },
  '.cm-diagnostic-error': { borderLeft: '3px solid var(--destructive)' },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--destructive)',
    textDecorationSkipInk: 'none',
    textUnderlineOffset: '3px',
  },
  '.cm-gutter-lint': { width: '14px' },
  '.cm-gutter-lint .cm-gutterElement': { padding: '0 0 0 4px' },
  '.cm-panels': { backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--syntax-kw)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syntax-str)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syntax-num)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syntax-cmt)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.standard(t.name), t.function(t.propertyName)], color: 'var(--syntax-fn)' },
  { tag: [t.typeName, t.className], color: 'var(--syntax-type)' },
  { tag: [t.special(t.name), t.quote], color: 'var(--syntax-type)' },
  { tag: [t.punctuation, t.bracket, t.separator], color: 'var(--muted-foreground)' },
  { tag: t.operator, color: 'var(--muted-foreground)' },
]);

export const editorTheme = [base, syntaxHighlighting(highlight)];
