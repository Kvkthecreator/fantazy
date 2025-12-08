import { apiClient } from "@/lib/api/client";

export async function triggerBlockParser(
  basket_id: string,
  payload: { raw_dump: string; media?: any[] }
) {
  await apiClient.request("/api/agent-run", {
    method: "POST",
    body: JSON.stringify({
      agent: "orch_block_manager_agent",
      input: { basket_id, ...payload },
    })
  });
}
