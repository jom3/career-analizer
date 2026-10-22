// Posiciona la vista en el ítem recién agregado. El timeout espera el render
// reactivo del nuevo control.
export function scrollToItem(prefix: string, index: number): void {
  setTimeout(() => {
    document
      .getElementById(`${prefix}-item-${index}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 0);
}
