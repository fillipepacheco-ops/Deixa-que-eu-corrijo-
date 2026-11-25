/** Utilitários de edição em <input>/<textarea> não controlados. */
export type TextField = HTMLInputElement | HTMLTextAreaElement;

/** Insere texto no cursor (substituindo a seleção) e posiciona o cursor. */
export function insertAtCursor(el: TextField, text: string, cursorFromStart?: number) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.focus();
  el.setRangeText(text, start, end, "end");
  if (cursorFromStart !== undefined) {
    const pos = start + cursorFromStart;
    el.setSelectionRange(pos, pos);
  }
  // avisa o React/formulário que o valor mudou (atualiza a prévia)
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
