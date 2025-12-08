import type { BlockDTO } from "@/shared/contracts/documents";

export const DEV_MOCK_BLOCKS: BlockDTO[] = [
  {
    id: "mock1",
    basket_id: "dev-basket",
    title: null,
    body_md: "We maintain an upbeat and friendly style that excites readers.",
    state: "PROPOSED",
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      semantic_type: "tone",
      scope: null,
      canonical_value: "upbeat and friendly",
      actor: "tester",
    },
  },
  {
    id: "mock2",
    basket_id: "dev-basket",
    title: null,
    body_md: "Our messaging targets busy founders seeking quick wins.",
    state: "PROPOSED",
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      semantic_type: "audience",
      scope: null,
      canonical_value: "busy founders",
      actor: "tester",
    },
  },
];
