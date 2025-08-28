// src/services/api.ts - Fixed version
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MediaFile {
  filename: string;
  relative_path: string;
  folder: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive';
  size: number;
  modified: string;
  thumbnail?: string;
  url: string;
}

export interface VideoInfo {
  filename: string;
  duration: number;
  size: number;
  video_codec?: string;
  audio_codec?: string;
  format?: string;
  resolution?: string;
  bitrate?: string;
  web_compatible: boolean;
  stream_url: string;
}

export interface User {
  id: string;
  username: string;
  is_admin: boolean;
}

export interface SearchParams {
  query?: string;
  type?: string;
  folder?: string;
  limit?: number;
  offset?: number;
}

export interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface FolderThumbnailData {
  thumbnail_url: string;
  inherit_to_children: boolean;
  uploaded_at: string;
  thumbnail_filename?: string;
}

export interface FolderThumbnailsResponse {
  success: boolean;
  data: { [key: string]: FolderThumbnailData | string };
  error?: string;
}
class ApiService {
  private baseUrl: string;

  constructor() {
    // Use the current hostname for network access
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    
    if (isLocalhost) {
      this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    } else {
      // For network access, use the current hostname with port 5000
      this.baseUrl = `http://${hostname}:5000`;
    }
    
    console.log('API Base URL:', this.baseUrl);
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include', // This is crucial for cross-device sessions
        ...options,
      });

      const contentType = response.headers.get('content-type');
      
      // Check if we got HTML instead of JSON (indicates server redirected to login)
      if (contentType?.includes('text/html')) {
        // Server redirected to login page, user is not authenticated
        if (response.status === 200 && response.url.includes('/login')) {
          return {
            success: false,
            error: 'Authentication required',
          };
        }
      }

      // Handle authentication errors properly
      if (response.status === 401) {
        return {
          success: false,
          error: 'Unauthorized',
        };
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          success: false,
          error: data?.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Authentication
  async login(username: string, password: string): Promise<ApiResponse<User>> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      console.log('Sending login request to server...');
      
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Essential for session cookies
      });

      console.log('Login response status:', response.status);
      console.log('Login response redirected:', response.redirected);
      console.log('Login response URL:', response.url);

      // Check for successful login (redirect or success status)
      if (response.redirected || response.url.includes('/gallery') || response.status === 200) {
        // Try to determine admin status from a follow-up request
        try {
          const statsResponse = await fetch(`${this.baseUrl}/api/admin/stats`, {
            credentials: 'include'
          });
          const isAdmin = statsResponse.ok;
          
          console.log('User is admin:', isAdmin);
          
          return { 
            success: true, 
            data: { 
              id: '1', 
              username, 
              is_admin: isAdmin 
            } 
          };
        } catch (adminCheckError) {
          console.warn('Could not determine admin status:', adminCheckError);
          // Default to non-admin if check fails
          return { 
            success: true, 
            data: { 
              id: '1', 
              username, 
              is_admin: false 
            } 
          };
        }
      }

      // If we get here, login failed
      console.log('Login failed - no redirect detected');
      return { success: false, error: 'Invalid credentials' };
      
    } catch (error) {
      console.error('Login request error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  }

  async register(userData: {
    username: string;
    password: string;
    confirm_password: string;
  }): Promise<ApiResponse> {
    const formData = new FormData();
    Object.entries(userData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.redirected || response.url.includes('/login')) {
        return { success: true, message: 'Registration successful' };
      }

      return { success: false, error: 'Registration failed' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed' 
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'GET',
        credentials: 'include',
      });
      console.log('Logout request sent to server');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local data
      localStorage.removeItem('username');
      localStorage.removeItem('isAdmin');
    }
  }

  // Media Files
  async getFiles(params?: {
    folder?: string;
    type?: string;
  }): Promise<ApiResponse<MediaFile[]>> {
    const searchParams = new URLSearchParams();
    if (params?.folder) searchParams.append('folder', params.folder);
    if (params?.type) searchParams.append('type', params.type);

    return this.request(`/api/files?${searchParams.toString()}`);
  }

  // Search functionality
  async searchFiles(params: SearchParams): Promise<ApiResponse<MediaFile[]>> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.append('text', params.query);
    if (params.type) searchParams.append('type', params.type);
    if (params.folder) searchParams.append('folder', params.folder);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    return this.request(`/api/search?${searchParams.toString()}`);
  }

  async getFolders(params?: {
    type?: string;
    flat?: boolean;
  }): Promise<ApiResponse> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.append('type', params.type);
    if (params?.flat) searchParams.append('flat', 'true');

    return this.request(`/api/folders?${searchParams.toString()}`);
  }

  async uploadFile(
    file: File, 
    folder?: string,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            success: xhr.status >= 200 && xhr.status < 300,
            data: response,
            error: xhr.status >= 400 ? response.error : undefined,
          });
        } catch {
          resolve({
            success: false,
            error: 'Invalid response',
          });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Upload failed',
        });
      });

      xhr.open('POST', `${this.baseUrl}/api/upload`);
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  }

  async uploadMultipleFiles(
    files: File[],
    folder?: string,
    onProgress?: (filename: string, progress: number) => void,
    onFileComplete?: (filename: string, success: boolean, error?: string) => void
  ): Promise<ApiResponse<{ successful: number; failed: number; errors: string[] }>> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const file of files) {
      try {
        const response = await this.uploadFile(
          file,
          folder,
          (progress) => onProgress?.(file.name, progress)
        );

        if (response.success) {
          results.successful++;
          onFileComplete?.(file.name, true);
        } else {
          results.failed++;
          const error = response.error || 'Upload failed';
          results.errors.push(`${file.name}: ${error}`);
          onFileComplete?.(file.name, false, error);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        results.errors.push(`${file.name}: ${errorMessage}`);
        onFileComplete?.(file.name, false, errorMessage);
      }
    }

    return {
      success: results.successful > 0,
      data: results,
    };
  }

  async deleteFile(filename: string): Promise<ApiResponse> {
    return this.request(`/api/delete/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
  }

  async createFolder(folderPath: string, fileType: string): Promise<ApiResponse> {
    return this.request('/api/create-folder', {
      method: 'POST',
      body: JSON.stringify({
        folder_path: folderPath,
        file_type: fileType,
      }),
    });
  }

  async moveFiles(filePaths: string[], destinationFolder: string, destinationType: string): Promise<ApiResponse> {
    return this.request('/api/move-files', {
      method: 'POST',
      body: JSON.stringify({
        file_paths: filePaths,
        destination_folder: destinationFolder,
        destination_type: destinationType,
      }),
    });
  }

  // Video specific
  async getVideoInfo(filename: string): Promise<ApiResponse<VideoInfo>> {
    return this.request(`/api/video/info/${encodeURIComponent(filename)}`);
  }

  getStreamUrl(filename: string): string {
    return `${this.baseUrl}/stream/${encodeURIComponent(filename)}`;
  }

  getThumbnailUrl(filename: string): string {
    return `${this.baseUrl}/thumbnail/${filename}`;
  }

  // Admin
  async getAdminStats(): Promise<ApiResponse> {
    return this.request('/api/admin/stats');
  }

  async refreshJellyfin(): Promise<ApiResponse> {
    return this.request('/api/admin/refresh-jellyfin', {
      method: 'POST',
    });
  }

  async generateThumbnails(): Promise<ApiResponse> {
    return this.request('/api/admin/generate-thumbnails', {
      method: 'POST',
    });
  }

  async cleanupThumbnails(): Promise<ApiResponse> {
    return this.request('/api/admin/cleanup-thumbnails', {
      method: 'POST',
    });
  }

  // Batch operations
  async batchDelete(filenames: string[]): Promise<ApiResponse> {
    return this.request('/api/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ filenames }),
    });
  }

  async getUploadStatus(): Promise<ApiResponse<UploadProgress[]>> {
    return this.request('/api/upload-status');
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // File type detection
  getFileCategory(filename: string): 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive' {
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    const categories = {
      image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'ico'],
      video: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
      audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus'],
      document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'md', 'csv', 'odt', 'ods', 'odp'],
      code: ['py', 'js', 'ts', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'php', 'java', 'cpp', 'h', 'sql'],
      archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz2', 'txz']
    };

    for (const [category, extensions] of Object.entries(categories)) {
      if (extensions.includes(extension)) {
        return category as any;
      }
    }

    return 'document'; // Default fallback
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        credentials: 'include',
      });
      return {
        success: response.ok,
        data: response.ok ? { status: 'healthy' } : null,
        error: response.ok ? undefined : 'Service unavailable',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }
}

export const apiService = new ApiService();