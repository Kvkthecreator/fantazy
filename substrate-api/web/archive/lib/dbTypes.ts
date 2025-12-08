export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      blocks: {
        Row: {
          id: string;
          basket_id: string | null;
          workspace_id: string | null;
          parent_block_id: string | null;  // V3.0: Universal versioning
          semantic_type: string;
          content: string | null;
          title: string | null;
          version: number;
          state: string;
          scope: string | null;  // V3.0: WORKSPACE | ORG | GLOBAL
          anchor_role: string | null;  // V3.0: Emergent anchor (free-text)
          anchor_status: string | null;  // V3.0: proposed | accepted | locked
          anchor_confidence: number | null;  // V3.0: 0.0-1.0
          confidence_score: number | null;
          canonical_value: string | null;
          origin_ref: string | null;
          raw_dump_id: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string | null;
          last_validated_at: string | null;
        };
      };
      baskets: {
        Row: {
          id: string;
          name: string | null;
      status: string;
      created_at: string;
      user_id: string;
      raw_dump_id: string;
      workspace_id: string;
    };
      };
      basket_signatures: {
        Row: {
          basket_id: string;
          workspace_id: string;
          summary: string | null;
          anchors: Json | null;
          entities: string[] | null;
          keywords: string[] | null;
          embedding: number[] | null;
          last_refreshed: string;
          ttl_hours: number;
          source_reflection_id: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      events: {
        Row: {
          id: string;
          basket_id: string | null;
          block_id: string | null;
          kind: string | null;
          payload: Record<string, any> | null;
          ts: string;
        };
      };
      documents: {
        Row: {
          id: string;
          basket_id: string | null;
          title: string;
          content_raw: string;
          created_at: string;
          updated_at: string;
        };
      };
      mcp_activity_logs: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          tool: string;
          host: string;
          result: string;
          latency_ms: number | null;
          basket_id: string | null;
          selection_decision: string | null;
          selection_score: number | null;
          error_code: string | null;
          session_id: string | null;
          fingerprint_summary: string | null;
          metadata: Json | null;
          created_at: string;
        };
      };
      mcp_unassigned_captures: {
        Row: {
          id: string;
          workspace_id: string;
          requested_by: string | null;
          tool: string;
          summary: string | null;
          payload: Json | null;
          fingerprint: Json | null;
          candidates: Json | null;
          status: string;
          assigned_basket_id: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
          updated_at: string;
          source_host?: string | null;
          source_session?: string | null;
        };
      };
      timeline_events: {
        Row: {
          id: number;
          basket_id: string;
          workspace_id: string;
          ts: string | null;
          kind: string;
          ref_id: string | null;
          preview: string | null;
          payload: Json | null;
          source_host: string | null;
          source_session: string | null;
        };
      };
    };
    Views: {
      v_basket_overview: {
        Row: {
          id: string;
          name: string | null;
          raw_dump_body: string | null;
          created_at: string | null;
        };
      };
      mcp_activity_host_recent: {
        Row: {
          workspace_id: string;
          host: string;
          last_seen_at: string | null;
          calls_last_hour: number | null;
          errors_last_hour: number | null;
          p95_latency_ms: number | null;
        };
      };
    };
  };
}
