// Ingest API types for batch operations

export type IngestItem = {
  dump_request_id: string;
  text_dump?: string;
  file_url?: string;
  meta?: Record<string, unknown>;
};

export type IngestReq = {
  idempotency_key: string;
  basket?: {
    name?: string;
  };
  dumps: IngestItem[];
};

export type IngestRes = {
  basket_id: string;
  id: string;
  name: string;
  dumps: Array<{
    dump_id: string;
  }>;
};