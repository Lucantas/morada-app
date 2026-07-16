type Categorizable = { id: string; category: string; description: string };
type CategoryRule = { name: string; keywords: string };

function norm(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function reclassifyAccounts(
  categories: CategoryRule[],
  accounts: Categorizable[],
): { changed: Categorizable[]; reclassified: number } {
  const changed: Categorizable[] = [];
  for (const account of accounts) {
    const hay = norm(`${account.description} ${account.category}`);
    const hit = categories.find((category) =>
      norm(category.keywords)
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .some((keyword) => hay.includes(keyword)),
    );
    if (hit && hit.name !== account.category) {
      changed.push({ ...account, category: hit.name });
    }
  }
  return { changed, reclassified: changed.length };
}
