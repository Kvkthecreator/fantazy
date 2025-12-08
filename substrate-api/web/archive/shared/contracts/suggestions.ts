// AI-generated suggestions and recommendations

export type Suggestion = {
  id: string;
  basket_id: string;
  type: "question" | "insight" | "action" | "resource";
  title: string;
  description: string;
  confidence: number;
  metadata?: Record<string, any>;
  created_at: string;
};