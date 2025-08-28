// src/utils/fileTypes.ts
import { 
  Film, 
  Image, 
  Music, 
  FileText, 
  Archive,
  Code,
  File,
  LucideIcon
} from 'lucide-react';

export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive' | 'unknown';

export interface FileTypeInfo {
  category: FileCategory;
  icon: LucideIcon;
  color: string;
  extensions: string[];
  maxSize?: number; // in bytes
  description: string;
}

export const FILE_TYPES: Record<FileCategory, FileTypeInfo> = {
  image: {
    category: 'image',
    icon: Image,
    color: 'text-green-500',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'ico'],
    maxSize: 100 * 1024 * 1024, // 100MB
    description: 'Images and graphics'
  },
  video: {
    category: 'video',
    icon: Film,
    color: 'text-blue-500',
    extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    maxSize: 10 * 1024 * 1024 * 1024, // 10GB
    description: 'Video files and movies'
  },
  audio: {
    category: 'audio',
    icon: Music,
    color: 'text-purple-500',
    extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus'],
    maxSize: 500 * 1024 * 1024, // 500MB
    description: 'Audio files and music'
  },
  document: {
    category: 'document',
    icon: FileText,
    color: 'text-orange-500',
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'md', 'csv', 'odt', 'ods', 'odp'],
    maxSize: 1 * 1024 * 1024 * 1024, // 1GB
    description: 'Documents and text files'
  },
  code: {
    category: 'code',
    icon: Code,
    color: 'text-cyan-500',
    extensions: ['py', 'js', 'ts', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'php', 'java', 'cpp', 'h', 'sql'],
    maxSize: 50 * 1024 * 1024, // 50MB
    description: 'Source code and scripts'
  },
  archive: {
    category: 'archive',
    icon: Archive,
    color: 'text-yellow-500',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz2', 'txz'],
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    description: 'Compressed archives'
  },
  unknown: {
    category: 'unknown',
    icon: File,
    color: 'text-gray-500',
    extensions: [],
    description: 'Unknown file type'
  }
};

export const getFileCategory = (filename: string): FileCategory => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  for (const [category, info] of Object.entries(FILE_TYPES)) {
    if (info.extensions.includes(extension)) {
      return category as FileCategory;
    }
  }
  
  return 'unknown';
};

export const getFileTypeInfo = (filename: string): FileTypeInfo => {
  const category = getFileCategory(filename);
  return FILE_TYPES[category];
};

export const isValidFileType = (filename: string, allowedCategories?: FileCategory[]): boolean => {
  if (!allowedCategories || allowedCategories.length === 0) {
    return true; // Allow all types if no restrictions
  }
  
  const category = getFileCategory(filename);
  return allowedCategories.includes(category);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateFileSize = (file: File): { valid: boolean; error?: string } => {
  const typeInfo = getFileTypeInfo(file.name);
  
  if (typeInfo.maxSize && file.size > typeInfo.maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size for ${typeInfo.category} files is ${formatFileSize(typeInfo.maxSize)}`
    };
  }
  
  return { valid: true };
};

export const getAcceptedFileTypes = (categories: FileCategory[]): string => {
  const extensions = categories.reduce((acc, category) => {
    const info = FILE_TYPES[category];
    acc.push(...info.extensions.map(ext => `.${ext}`));
    return acc;
  }, [] as string[]);
  
  return extensions.join(',');
};

// Mime type mapping for better file detection
export const MIME_TYPE_MAP: Record<string, FileCategory> = {
  // Images
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/bmp': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  
  // Videos
  'video/mp4': 'video',
  'video/avi': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/webm': 'video',
  
  // Audio
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
  'audio/ogg': 'audio',
  
  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
  'text/markdown': 'document',
  
  // Archives
  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  
  // Code
  'text/javascript': 'code',
  'application/json': 'code',
  'text/html': 'code',
  'text/css': 'code',
  'application/xml': 'code',
};

export const getFileCategoryFromMime = (mimeType: string): FileCategory => {
  return MIME_TYPE_MAP[mimeType] || 'unknown';
};

export const getFileCategoryAdvanced = (file: File): FileCategory => {
  // First try mime type
  const mimeCategory = getFileCategoryFromMime(file.type);
  if (mimeCategory !== 'unknown') {
    return mimeCategory;
  }
  
  // Fallback to extension-based detection
  return getFileCategory(file.name);
};