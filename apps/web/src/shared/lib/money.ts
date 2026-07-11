/** Monetary amounts are integer cents (BRL). Format to Brazilian notation. */

export function formatBRL(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatBRLShort(cents: number): string {
  const value = Math.round(cents / 100);
  return value.toLocaleString('pt-BR');
}
