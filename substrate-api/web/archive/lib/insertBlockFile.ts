// web/lib/insertBlockFile.ts

import { createBrowserClient } from "@/lib/supabase/clients";

interface InsertBlockFileArgs {
  user_id: string;
  file_url: string;
  label: string;
  note?: string;
  file_size: number; // in bytes
  associated_block_id?: string;
  is_primary?: boolean;
}

export async function insertBlockFile({
  user_id,
  file_url,
  label,
  note = "",
  file_size,
  associated_block_id,
  is_primary = false,
}: InsertBlockFileArgs) {
  const supabase = createBrowserClient();

  const { error } = await supabase.from("block_files").insert({
    user_id,
    file_url,
    label,
    note,
    file_size,
    associated_block_id,
    is_primary,
  });

  return { success: !error, error };
}
