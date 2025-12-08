import { listBasketsByWorkspace } from "./listBasketsByWorkspace";
import { apiFetch } from "@/lib/server/http";

interface Params {
  workspaceId: string;
  idempotencyKey: string;
  name: string;
}

export async function getOrCreateDefaultBasket({ workspaceId, idempotencyKey, name }: Params) {
  const { data: existing, error } = await listBasketsByWorkspace(workspaceId);
  if (error) throw error;
  if (existing && existing.length >= 1) {
    return existing[0];
  }

  try {
    const res = await apiFetch("/api/baskets/new", {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ workspace_id: workspaceId, name }),
    });

    if (res.ok || res.status === 409) {
      const data = await res.json();
      const id = data.id || data.basket_id;
      return { id };
    }

    const errorText = await res.text();
    throw new Error(`Basket creation failed: ${res.status} ${errorText}`);
  } catch (err: any) {
    if (err?.status === 401 || err?.message === 'NO_TOKEN') {
      throw new Error('Authentication required for basket creation');
    }
    throw new Error(`Failed to create default basket: ${err.message}`);
  }
}
