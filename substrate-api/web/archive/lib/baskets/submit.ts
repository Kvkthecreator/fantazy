// web/lib/baskets/submit.ts

export interface BasketValues {
  topic: string;
  intent: string;
  insight?: string;
  reference_file_ids?: string[];
}

export interface ContextBlock {
  id?: string;
  type: "topic" | "intent" | "reference" | "insight";
  label: string;
  content?: string;
  file_ids?: string[];
  is_primary: boolean;
  meta_scope: "basket";
  source?: string;
  associated_block_id?: string;
}

export function buildContextBlocks(values: BasketValues): ContextBlock[] {
  if (!values.topic.trim()) throw new Error("Topic required");
  if (!values.intent.trim()) throw new Error("Intent required");

  const blocks: ContextBlock[] = [];

  blocks.push({
    type: "topic",
    label: "What are we working on?",
    content: values.topic,
    is_primary: true,
    meta_scope: "basket",
  });

  blocks.push({
    type: "intent",
    label: "Intent",
    content: values.intent,
    is_primary: true,
    meta_scope: "basket",
  });

  if (values.reference_file_ids && values.reference_file_ids.length) {
    blocks.push({
      type: "reference",
      label: "reference files",
      is_primary: true,
      meta_scope: "basket",
      source: "user_upload",
      file_ids: values.reference_file_ids,
    });
  }

  if (values.insight && values.insight.trim()) {
    blocks.push({
      type: "insight",
      label: "Insight",
      content: values.insight,
      is_primary: true,
      meta_scope: "basket",
    });
  }

  return blocks;
}

import { apiClient } from "../api/client";

export async function createBasket(values: BasketValues): Promise<{ basket_id: string }> {
  const payload = {
    idempotency_key: crypto.randomUUID(),
    basket: { name: values.topic || "Untitled Basket" },
  };
  return apiClient.request<{ basket_id: string }>("/api/baskets/new", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
