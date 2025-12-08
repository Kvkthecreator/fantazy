// web/lib/insertUserFile.ts
import { createBrowserClient } from "@/lib/supabase/clients";

/**
 * Inserts a new file record into the block_files table.
 * Used for user-library persistent uploads.
 */
export async function insertUserFile({
  user_id,
  file_url,
  file_name,
  label,
  note,
  size_bytes,
}: {
  user_id: string;
  file_url: string;
  file_name: string;
  label: string;
  note?: string;
  size_bytes: number;
}) {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
  .from("block_files")
    .insert([
      {
        user_id,
        file_url,
        file_name,
        label,
        note: note || null,
        size_bytes,
      },
    ]);

  if (error) {
    console.error("[insertUserFile] DB insert error:", error);
    throw new Error("Failed to save file metadata.");
  }

  return data?.[0];
}
