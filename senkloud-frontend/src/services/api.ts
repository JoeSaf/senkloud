import { ApiResponse, MediaFile, VideoInfo, SearchParams, UploadProgress } from './types';

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

      // Handle empty responses or non-JSON responses
      let data = null;
      const text = await response.text();
      
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('JSON parse error:', parseError, 'Response text:', text);
          return {
            success: false,
            error: 'Invalid JSON response from server',
          };
        }
      }

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
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Authentication
  async login(username: string, password: string): Promise<ApiResponse<{ user: any }>> {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async register(username: string, password: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const text = await response.text();
      let data = null;
      
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          // Response might be HTML (redirect), which means success in this case
          if (response.ok && text.includes('<!DOCTYPE html>')) {
            return { success: true };
          }
          return { success: false, error: 'Invalid response format' };
        }
      }

      return {
        success: response.ok,
        data,
        error: response.ok ? undefined : data?.error || 'Registration failed'
      };
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
          // Handle empty response
          if (!xhr.responseText) {
            resolve({
              success: false,
              error: 'Empty response from server',
            });
            return;
          }

          const response = JSON.parse(xhr.responseText);
          resolve({
            success: xhr.status >= 200 && xhr.status < 300,
            data: response,
            error: xhr.status >= 400 ? response.error : undefined,
          });
        } catch (parseError) {
          console.error('Upload response parse error:', parseError, 'Response:', xhr.responseText);
          resolve({
            success: false,
            error: 'Invalid JSON response from server',
          });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Upload failed - network error',
        });
      });

      xhr.addEventListener('timeout', () => {
        resolve({
          success: false,
          error: 'Upload timeout',
        });
      });

      xhr.open('POST', `${this.baseUrl}/api/upload`);
      xhr.withCredentials = true;
      xhr.timeout = 300000; // 5 minutes timeout
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

  // ==================== FOLDER THUMBNAIL METHODS ====================

  /**
   * Get all folder thumbnails from the backend
   */
  async getFolderThumbnails(): Promise<FolderThumbnailsResponse> {
    try {
      const response = await this.request<{ [key: string]: FolderThumbnailData | string }>('/api/folder-thumbnails');
      return {
        success: response.success,
        data: response.data || {},
        error: response.error
      };
    } catch (error) {
      console.error('Error fetching folder thumbnails:', error);
      return { success: false, data: {}, error: 'Failed to fetch folder thumbnails' };
    }
  }

  /**
   * Upload a custom thumbnail for a folder
   */
  async uploadFolderThumbnail(
    file: File,
    folderPath: string,
    fileType: string,
    inheritToChildren: boolean = false
  ): Promise<{ success: boolean; thumbnail_url?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('thumbnail', file);
      formData.append('folder_path', folderPath);
      formData.append('file_type', fileType);
      formData.append('inherit_to_children', inheritToChildren.toString());

      const response = await fetch(`${this.baseUrl}/api/folder-thumbnail`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      // Handle empty response
      const text = await response.text();
      if (!text) {
        return { success: false, error: 'Empty response from server' };
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('Folder thumbnail upload parse error:', parseError, 'Response:', text);
        return { success: false, error: 'Invalid JSON response from server' };
      }
      
      if (response.ok) {
        return { success: true, thumbnail_url: result.thumbnail_url };
      } else {
        return { success: false, error: result.error || 'Upload failed' };
      }
    } catch (error) {
      console.error('Error uploading folder thumbnail:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Delete a custom folder thumbnail
   */
  async deleteFolderThumbnail(
    folderPath: string,
    fileType: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.request('/api/folder-thumbnail', {
        method: 'DELETE',
        body: JSON.stringify({
          folder_path: folderPath,
          file_type: fileType
        })
      });

      return { success: response.success, error: response.error };
    } catch (error) {
      console.error('Error deleting folder thumbnail:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Get thumbnail for a specific folder
   */
  async getFolderThumbnail(
    folderPath: string,
    fileType: string
  ): Promise<{ success: boolean; thumbnail_url?: string; error?: string }> {
    try {
      const response = await this.request(`/api/folder-thumbnail/${fileType}/${encodeURIComponent(folderPath)}`);
      
      return { 
        success: response.success, 
        thumbnail_url: (response.data as any)?.thumbnail_url, 
        error: response.error 
      };
    } catch (error) {
      console.error('Error getting folder thumbnail:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Update inheritance setting for an existing folder thumbnail
   */
  async updateFolderThumbnailInheritance(
    folderPath: string,
    fileType: string,
    inheritToChildren: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.request('/api/folder-thumbnail/inheritance', {
        method: 'PATCH',
        body: JSON.stringify({
          folder_path: folderPath,
          file_type: fileType,
          inherit_to_children: inheritToChildren
        })
      });

      return { success: response.success, error: response.error };
    } catch (error) {
      console.error('Error updating inheritance:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Get folder structure with thumbnail information
   */
  async getFolderStructureWithThumbnails(fileType?: string): Promise<ApiResponse<FolderStructureItem[]>> {
    const params = new URLSearchParams();
    if (fileType) params.append('type', fileType);
    
    return this.request(`/api/folder-structure-with-thumbnails?${params.toString()}`);
  }

  /**
   * Get thumbnail statistics
   */
  async getFolderThumbnailStats(): Promise<ApiResponse<FolderThumbnailStats>> {
    return this.request('/api/folder-thumbnail-stats');
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
        error: error instanceof Error ? error.message : 'Service unavailable',
      };
    }
  }
}

export const apiService = new ApiService();
export { ApiService };
export * from './types';