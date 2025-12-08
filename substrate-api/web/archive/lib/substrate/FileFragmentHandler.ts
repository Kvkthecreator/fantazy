// TRUE CONTEXT OS - File Fragment Handler
// Reusable for raw_dumps AND onboarding

import { getFragmentType } from './FragmentTypes';
import type { Fragment, FragmentType } from './FragmentTypes';
import { CANONICAL_MAX_FILE_SIZE_BYTES, SUPPORTED_MIME_TYPES } from '@/shared/constants/canonical_file_types';

export class FileFragmentHandler {
  private static readonly ALLOWED_MIME_TYPES = new Set(SUPPORTED_MIME_TYPES as readonly string[]);

  private static readonly MAX_FILE_SIZE = CANONICAL_MAX_FILE_SIZE_BYTES;

  static validateFile(file: File): { valid: boolean; error?: string } {
    if (!this.ALLOWED_MIME_TYPES.has(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} not supported. Accepted types: ${Array.from(this.ALLOWED_MIME_TYPES).join(', ')}`
      };
    }
    
    if (file.size > this.MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `File too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB` 
      };
    }
    
    return { valid: true };
  }

  static async processFragment(
    fragment: Fragment, 
    onProgress: (status: string) => void
  ): Promise<Fragment> {
    const { type, content, metadata } = fragment;
    
    if (!(content instanceof File)) {
      return fragment; // Already processed
    }

    const validation = this.validateFile(content);
    if (!validation.valid) {
      return {
        ...fragment,
        metadata: {
          ...metadata,
          processing: 'error'
        }
      };
    }

    try {
      switch (type) {
        case 'text-dump':
          return await this.processTextDump(fragment, content, onProgress);
        case 'pdf':
          return await this.processPDF(fragment, content, onProgress);
        case 'image':
          return await this.processImage(fragment, content, onProgress);
        default:
          throw new Error(`Unsupported fragment type: ${type}`);
      }
    } catch (error) {
      onProgress(`Error processing ${content.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        ...fragment,
        metadata: {
          ...metadata,
          processing: 'error'
        }
      };
    }
  }

  private static async processTextDump(
    fragment: Fragment, 
    file: File, 
    onProgress: (status: string) => void
  ): Promise<Fragment> {
    onProgress(`Reading text file ${file.name}...`);
    
    const text = await file.text();
    const charCount = text.length;
    const lineCount = text.split('\n').length;
    
    onProgress(`Processed ${charCount.toLocaleString()} characters from ${file.name}`);
    
    return {
      ...fragment,
      content: text,
      metadata: {
        ...fragment.metadata,
        size: file.size,
        processing: 'complete',
        extractedText: text // For search/analysis
      }
    };
  }

  private static async processPDF(
    fragment: Fragment, 
    file: File, 
    onProgress: (status: string) => void
  ): Promise<Fragment> {
    onProgress(`Processing PDF ${file.name}...`);
    
    try {
      // For now, store the file as base64 for backend processing
      const base64 = await this.fileToBase64(file);
      
      onProgress(`PDF ${file.name} ready for text extraction`);
      
      return {
        ...fragment,
        content: base64,
        metadata: {
          ...fragment.metadata,
          size: file.size,
          processing: 'complete'
          // pageCount will be added after backend processing
        }
      };
    } catch (error) {
      throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async processImage(
    fragment: Fragment, 
    file: File, 
    onProgress: (status: string) => void
  ): Promise<Fragment> {
    onProgress(`Processing image ${file.name}...`);
    
    try {
      const base64 = await this.fileToBase64(file);
      const dimensions = await this.getImageDimensions(file);
      
      onProgress(`Image ${file.name} processed successfully`);
      
      return {
        ...fragment,
        content: base64,
        metadata: {
          ...fragment.metadata,
          size: file.size,
          dimensions,
          processing: 'complete'
        }
      };
    } catch (error) {
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data URL prefix
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private static async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }

  // Batch process multiple fragments
  static async processFragments(
    fragments: Fragment[],
    onProgress: (status: string, fragmentIndex: number) => void
  ): Promise<Fragment[]> {
    const processed: Fragment[] = [];
    
    for (let i = 0; i < fragments.length; i++) {
      const fragment = fragments[i];
      const processedFragment = await this.processFragment(
        fragment,
        (status) => onProgress(status, i)
      );
      processed.push(processedFragment);
    }
    
    return processed;
  }

  // Reusable upload handler for any context
  static async handleUpload(
    files: File[],
    context: 'substrate' | 'onboarding',
    onProgress: (status: string) => void
  ): Promise<Fragment[]> {
    onProgress(`Uploading ${files.length} file(s)...`);
    
    const fragmentsWithNulls = files.map((file, index) => {
      const fragmentType = getFragmentType(file);
      if (!fragmentType) return null;
      
      return {
        id: `fragment-${Date.now()}-${index}`,
        type: fragmentType,
        content: file,
        position: index,
        metadata: {
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          processing: 'pending' as const
        }
      };
    });
    
    const fragments = fragmentsWithNulls.filter(fragment => fragment !== null);
    
    return await this.processFragments(fragments, (status, index) => {
      onProgress(`[${index + 1}/${files.length}] ${status}`);
    });
  }
}
