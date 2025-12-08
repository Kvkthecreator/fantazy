import { apiPost } from "@/lib/server/http";

export async function resolveTargetBasket(body?: unknown): Promise<string> {
  try {
    const res = await apiPost('/api/baskets/resolve', body);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Basket resolution failed: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    return data.id;
  } catch (err: any) {
    if (err?.status === 401 || err?.message === 'NO_TOKEN') {
      throw new Error('Authentication required for basket resolution');
    }
    throw new Error(`Failed to resolve basket: ${err.message}`);
  }
}
