import { apiClient } from "@/lib/api/client";

export interface TemplateBasketArgs {
  template_id: string;
  files: string[];
  guidelines?: string;
}

export async function createBasketFromTemplate(args: TemplateBasketArgs) {
  return apiClient.request<{ basket_id: string }>("/api/baskets/new-from-template", {
    method: "POST",
    body: JSON.stringify(args)
  });
}
