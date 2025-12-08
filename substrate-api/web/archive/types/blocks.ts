export type Block = {
  id: string;
  document_id?: string;
  type: string;
  content: string;
};

export type BlockWithHistory = Block & {
  prev_rev_id?: string | null;
  prev_content?: string | null;
};
