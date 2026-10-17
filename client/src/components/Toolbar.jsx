import { isolateSelection } from './isolateSelection.js';

export default function Toolbar({ editor }) {
  if (!editor) return null;

  const blockValue = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
    ? 'h3'
    : 'p';

  function setBlock(v) {
    const chain = isolateSelection(editor, editor.chain().focus());
    if (v === 'p') chain.setParagraph().run();
    else chain.toggleHeading({ level: Number(v[1]) }).run();
  }

  const toggleList = (type) => {
    const chain = isolateSelection(editor, editor.chain().focus());
    (type === 'bullet' ? chain.toggleBulletList() : chain.toggleOrderedList()).run();
  };

  const Btn = ({ label, title, active, onClick, disabled }) => (
    <button
      type="button"
      className={`tb ${active ? 'on' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="↶" title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
      <Btn label="↷" title="Redo (Ctrl+Shift+Z)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
      <span className="sep" />
      <select value={blockValue} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="sep" />
      <Btn label={<b>B</b>} title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <Btn label={<i>I</i>} title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <Btn label={<u>U</u>} title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <span className="sep" />
      <Btn label="• List" title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => toggleList('bullet')} />
      <Btn label="1. List" title="Numbered list" active={editor.isActive('orderedList')} onClick={() => toggleList('ordered')} />
    </div>
  );
}
