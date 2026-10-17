/**
 * Block formats (headings, lists) apply to whole blocks. When the selection is a partial
 * range inside ONE paragraph/heading, split that block around the selection first so only
 * the selected text changes format. Returns the same chain, with the selection re-set on the
 * isolated middle block. Does nothing for collapsed or multi-block selections.
 */
export function isolateSelection(editor, chain) {
  const { selection } = editor.state;
  const { $from, $to, from, to, empty } = selection;
  if (empty || !$from.sameParent($to) || !$from.parent.isTextblock) return chain;

  const needsEndSplit = to < $to.end(); // text remains after the selection
  const needsStartSplit = from > $from.start(); // text remains before the selection
  if (!needsEndSplit && !needsStartSplit) return chain;

  // Split at the end first so the start position is not shifted.
  if (needsEndSplit) chain = chain.setTextSelection(to).splitBlock();
  if (needsStartSplit) chain = chain.setTextSelection(from).splitBlock();

  const shift = needsStartSplit ? 2 : 0; // splitBlock adds a closing + opening token
  return chain.setTextSelection({ from: from + shift, to: to + shift });
}
