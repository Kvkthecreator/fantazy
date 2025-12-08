import type { BasketRow } from './listBasketsByWorkspace';

interface Params {
  baskets: BasketRow[];
  lastBasketId?: string | null;
}

export function pickMostRelevantBasket({ baskets, lastBasketId }: Params): BasketRow {
  if (baskets.length === 1) {
    const only = baskets[0];
    return lastBasketId === only.id ? only : only;
  }

  if (lastBasketId) {
    const match = baskets.find((b) => b.id === lastBasketId);
    if (match) return match;
  }

  return baskets[0];
}
