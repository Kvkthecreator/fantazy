import { SUPPORTED_MIME_TYPES, CANONICAL_MAX_FILE_SIZE_BYTES } from '@/shared/constants/canonical_file_types';

export const ALLOWED_MIME_TYPES = [...SUPPORTED_MIME_TYPES];
export const MAX_FILE_SIZE_MB = CANONICAL_MAX_FILE_SIZE_BYTES / (1024 * 1024);
