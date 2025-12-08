import { getAllBaskets } from './getAllBaskets';
import type { BasketOverview } from './getAllBaskets';

export async function getRecentBaskets(limit = 5): Promise<BasketOverview[]> {
  const all = await getAllBaskets();
  return all.slice(0, limit);
}
