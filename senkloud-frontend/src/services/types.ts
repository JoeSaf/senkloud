// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Media File Types
export interface MediaFile {
  filename: string;
  relative_path: string;
  folder: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive';
  size: number;
  modified: string;
  url: string;
  thumbnail?: string;
}

// Video Information
export interface VideoInfo {
  duration: string;
  format: string;
  resolution: string;
  bitrate?: string;
  web_compatible: boolean;
  stream_url: string;
}

// Search Parameters
export interface SearchParams {
  query?: string;
  type?: string;
  folder?: string;
  limit?: number;
  offset?: number;
}

// Upload Progress
export interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

// User Types
export interface User {
  id: string;
  username: string;
  is_admin: boolean;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  error?: string;
}

// Folder Thumbnail Types
export interface FolderThumbnailData {
  thumbnail_url: string;
  inherit_to_children: boolean;
  uploaded_at: string;
  thumbnail_filename?: string;
  auto_generated?: boolean;
}

export interface FolderThumbnailsResponse {
  success: boolean;
  data: { [key: string]: FolderThumbnailData | string };
  error?: string;
}

export interface FolderStructureItem {
  path: string;
  name: string;
  file_type: string;
  file_count: number;
  has_custom_thumbnail: boolean;
  inherits_thumbnail: boolean;
  depth: number;
  thumbnail_url?: string;
  children?: FolderStructureItem[];
}

export interface FolderThumbnailStats {
  total_custom_thumbnails: number;
  auto_generated_thumbnails: number;
  inherited_thumbnails: number;
  by_type: { image: number; video: number; audio: number };
  inheritance_enabled: number;
  total_folders: number;
  folders_without_thumbnails: number;
}

// Admin Stats
export interface AdminStats {
  total_files: number;
  total_size: string;
  by_type: {
    image: { count: number; size: string };
    video: { count: number; size: string };
    audio: { count: number; size: string };
    document: { count: number; size: string };
  };
  recent_uploads: MediaFile[];
  disk_usage?: {
    total: string;
    used: string;
    free: string;
    percent: number;
  };
}

// Batch Operation Results
export interface BatchOperationResult {
  successful: number;
  failed: number;
  errors: string[];
}

// File Category Type
export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive';

// Request Options
export interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

// Error Types
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Pagination
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// Upload Types
export interface UploadFileOptions {
  folder?: string;
  onProgress?: (progress: number) => void;
  timeout?: number;
}

export interface MultipleUploadOptions {
  folder?: string;
  onProgress?: (filename: string, progress: number) => void;
  onFileComplete?: (filename: string, success: boolean, error?: string) => void;
  concurrency?: number;
}

// Health Check
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  uptime?: number;
}

// Configuration
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  credentials: RequestCredentials;
}