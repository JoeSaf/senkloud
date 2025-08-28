/**
 * Utility functions for API handling and error management
 */

export interface SafeParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Safely parse JSON with error handling
 */
export function safeParseJSON<T = any>(text: string): SafeParseResult<T> {
  try {
    if (!text || text.trim() === '') {
      return {
        success: false,
        error: 'Empty response'
      };
    }

    const data = JSON.parse(text);
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Handle fetch response with proper error checking and JSON parsing
 */
export async function handleFetchResponse<T = any>(response: Response): Promise<SafeParseResult<T>> {
  try {
    // Check if response is ok
    if (!response.ok) {
      const text = await response.text();
      const parseResult = safeParseJSON(text);
      
      return {
        success: false,
        error: parseResult.success ? 
          parseResult.data?.error || `HTTP ${response.status}` :
          `HTTP ${response.status}: ${response.statusText}`
      };
    }

    // Get response text
    const text = await response.text();
    
    // Handle empty responses
    if (!text || text.trim() === '') {
      return {
        success: true,
        data: null as T
      };
    }

    // Parse JSON
    const parseResult = safeParseJSON<T>(text);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid JSON response: ${parseResult.error}`
      };
    }

    return {
      success: true,
      data: parseResult.data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a fetch request with timeout and error handling
 */
export async function createFetchRequest(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    throw error;
  }
}

/**
 * Validate file before upload
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadFile(
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): FileValidationResult {
  const {
    maxSize = 100 * 1024 * 1024, // 100MB default
    allowedTypes = [],
    allowedExtensions = []
  } = options;

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`
    };
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.some(type => file.type.startsWith(type))) {
    return {
      valid: false,
      error: `File type '${file.type}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }

  // Check file extension
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension '.${extension}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`
      };
    }
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Debounce function for API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Check if a response indicates authentication is required
 */
export function isAuthRequired(response: Response, text?: string): boolean {
  // Check status code
  if (response.status === 401) {
    return true;
  }

  // Check if redirected to login page
  if (response.status === 200 && response.url.includes('/login')) {
    return true;
  }

  // Check content type for HTML (might be login redirect)
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('text/html') && text?.includes('login')) {
    return true;
  }

  return false;
}

/**
 * Extract error message from various response formats
 */
export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    return error.error || error.message || 'Unknown error';
  }

  return 'Unknown error';
}

/**
 * Create a cancelable promise
 */
export function createCancelablePromise<T>(
  promise: Promise<T>
): { promise: Promise<T>; cancel: () => void } {
  let isCanceled = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then(result => {
        if (!isCanceled) {
          resolve(result);
        }
      })
      .catch(error => {
        if (!isCanceled) {
          reject(error);
        }
      });
  });

  return {
    promise: wrappedPromise,
    cancel: () => {
      isCanceled = true;
    }
  };
}

/**
 * Convert File to base64 for API transmission
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Check if current environment supports certain features
 */
export const supportsFileAPI = () => {
  return typeof File !== 'undefined' && typeof FileReader !== 'undefined';
};

export const supportsFormData = () => {
  return typeof FormData !== 'undefined';
};

export const supportsFetch = () => {
  return typeof fetch !== 'undefined';
};