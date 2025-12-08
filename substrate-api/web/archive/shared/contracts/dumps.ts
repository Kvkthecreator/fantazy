// Dump core types and API contracts

export type RawDump = {
  id: string;
  basket_id: string;
  workspace_id: string;
  body_md: string | null;
  file_url?: string | null;  // Supabase Storage URL for uploaded files
  dump_request_id?: string;
  source_meta?: Record<string, any>;
  processing_status: "unprocessed" | "processing" | "processed" | "failed";
  created_at: string;
  processed_at?: string;
};

// Legacy dump type for compatibility
export type Dump = {
  id: string;
  basket_id: string;
  body_md: string;
  created_at: string;
};

// API Request/Response types  
export type CreateDumpReq = {
  basket_id: string;
  dump_request_id: string;
  text_dump?: string;  // User text content (including pasted URLs) 
  file_url?: string;   // Supabase Storage URL for uploaded files
  source_meta?: {      // Renamed from 'meta' to match RPC
    client_ts?: string;
    ingest_trace_id?: string;
    [k: string]: any;
  };
};

export type CreateDumpRes = {
  dump_id: string;
  work_id?: string;  // Canon v2.1: Universal work orchestration ID
  status_url?: string;  // URL for real-time status tracking
  processing_method?: string;
  warning?: string;  // Non-fatal warnings
};