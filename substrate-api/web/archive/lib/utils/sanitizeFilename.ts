/**
 * Sanitize a filename for safe storage in Supabase Storage
 * - Replaces spaces with underscores
 * - Removes special characters except dots, underscores, and hyphens
 * - Preserves file extension
 * 
 * @param filename The original filename
 * @returns The sanitized filename safe for storage
 */
export function sanitizeFilename(filename: string): string {
  // Split filename and extension
  const lastDotIndex = filename.lastIndexOf('.');
  let name = filename;
  let extension = '';
  
  if (lastDotIndex > 0) {
    name = filename.substring(0, lastDotIndex);
    extension = filename.substring(lastDotIndex);
  }
  
  // Sanitize the name part
  const sanitizedName = name
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9_-]/g, ''); // Remove special characters except underscores and hyphens
  
  // Sanitize the extension (if any)
  const sanitizedExtension = extension
    .replace(/[^a-zA-Z0-9.]/g, ''); // Keep only alphanumeric and dots
  
  return sanitizedName + sanitizedExtension;
}