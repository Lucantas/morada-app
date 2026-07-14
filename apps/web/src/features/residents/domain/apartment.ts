// The apartment is identified by a number in the UI, but stored/labelled as
// "Apto NNN". These convert between the two so the input can be numeric-only.
export function apartmentNumber(label: string): string {
  return label.replace(/\D/g, '');
}

export function apartmentLabel(numberInput: string): string {
  const digits = numberInput.replace(/\D/g, '');
  return digits ? `Apto ${digits}` : '';
}
