// Workspace and membership types

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

export type WorkspaceMembership = {
  id: number;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at?: string;
};