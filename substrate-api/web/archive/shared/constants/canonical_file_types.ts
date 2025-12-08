/**
 * Canonical File Type Constants - YARNNN Canon v2.0 Compliant
 * 
 * Defines the authoritative set of supported file types for structured content processing.
 * These constants ensure consistency across frontend components, API routes, and backend processing.
 * 
 * Canon Philosophy:
 * - Text formats: Direct text content processing (immediate)
 * - Binary formats: Supabase Storage + structured extraction (PDF OCR, Image OCR)
 * - NO legacy formats: Removed CSV/HTML (tail data formats with poor structured extraction)
 * 
 * Usage:
 * - Frontend components: Use CANONICAL_* constants for accept attributes
 * - API routes: Validate against SUPPORTED_MIME_TYPES 
 * - Backend: ContentExtractor.get_supported_mime_types() must match these exactly
 */

// Canonical text formats - processed immediately as text content
export const CANONICAL_TEXT_MIME_TYPES = [
  'text/plain',
  'text/markdown',
] as const;

export const CANONICAL_TEXT_EXTENSIONS = [
  '.txt',
  '.md',
] as const;

// Canonical binary formats - stored in Supabase Storage, processed via structured extraction
export const CANONICAL_BINARY_MIME_TYPES = [
  // PDF format (structured text extraction via PyMuPDF)
  'application/pdf',
  // Image formats (OCR text extraction via pytesseract)
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
] as const;

export const CANONICAL_BINARY_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.tiff',
  '.webp',
] as const;

// Canonical size guard (aligned across frontend + API routes)
export const CANONICAL_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Combined canonical formats
export const SUPPORTED_MIME_TYPES = [
  ...CANONICAL_TEXT_MIME_TYPES,
  ...CANONICAL_BINARY_MIME_TYPES,
] as const;

export const SUPPORTED_FILE_EXTENSIONS = [
  ...CANONICAL_TEXT_EXTENSIONS,
  ...CANONICAL_BINARY_EXTENSIONS,
] as const;

// HTML accept attribute for file inputs
export const CANONICAL_ACCEPT_ATTRIBUTE = SUPPORTED_FILE_EXTENSIONS.join(',');

// Validation helpers
export function isCanonicalMimeType(mimeType: string): boolean {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isCanonicalFile(file: File): boolean {
  // First check MIME type
  if (isCanonicalMimeType(file.type)) {
    return true;
  }
  
  // Fallback to file extension check (for cases where MIME type is unreliable)
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return (SUPPORTED_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

export function getCanonicalMimeType(file: File): string | null {
  // If MIME type is canonical, use it
  if (isCanonicalMimeType(file.type)) {
    return file.type;
  }
  
  // Otherwise, infer from extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  
  if (extension === '.md') return 'text/markdown';
  if (extension === '.txt') return 'text/plain';
  if (extension === '.pdf') return 'application/pdf';
  if (['.jpg', '.jpeg'].includes(extension)) return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.bmp') return 'image/bmp';
  if (extension === '.tiff') return 'image/tiff';
  if (extension === '.webp') return 'image/webp';
  
  return null;
}

export function isCanonicalTextFormat(mimeType: string): boolean {
  return (CANONICAL_TEXT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isCanonicalBinaryFormat(mimeType: string): boolean {
  return (CANONICAL_BINARY_MIME_TYPES as readonly string[]).includes(mimeType);
}

// User-facing descriptions
export const SUPPORTED_FORMAT_DESCRIPTION = "Supported formats: Text (.txt, .md), PDF (.pdf), Images (.jpg, .png, .gif, .bmp, .tiff, .webp)";

export const PROCESSING_METHOD_DESCRIPTION = {
  text: "Text formats processed immediately as content",
  binary: "Binary formats stored in Supabase Storage, content extracted via OCR/PDF parsing"
};

// Legacy format mapping (for migration/cleanup)
export const REMOVED_LEGACY_FORMATS = {
  'text/csv': 'CSV removed - poor structured extraction, tail data format',
  'text/html': 'HTML removed - poor structured extraction, tail data format',
  'application/msword': 'DOC removed - not in canonical format set',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX removed - not in canonical format set'
} as const;
