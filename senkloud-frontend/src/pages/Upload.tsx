// src/pages/Upload.tsx - Fixed and Complete Version
import React, { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Upload as UploadIcon, 
  Film, 
  Image, 
  Music, 
  FileText, 
  X, 
  Check, 
  AlertCircle,
  Folder,
  Plus,
  RefreshCw,
  Archive
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: string;
  type: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive';
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FolderOption {
  name: string;
  path: string;
  display_name: string;
  depth: number;
}

const Upload: React.FC = () => {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFileType, setSelectedFileType] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch folders for the selected file type
  const { data: foldersResponse, refetch: refetchFolders } = useQuery({
    queryKey: ['folders', selectedFileType],
    queryFn: () => apiService.getFolders({ type: selectedFileType, flat: true }),
    enabled: !!selectedFileType,
  });

  const folders: FolderOption[] = foldersResponse?.success && selectedFileType 
    ? foldersResponse.data?.[selectedFileType] || []
    : [];

  const getFileCategory = (file: File): 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive' => {
    const type = file.type.toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    
    // Check by extension
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
    const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'json', 'xml'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
    
    if (videoExts.includes(extension)) return 'video';
    if (audioExts.includes(extension)) return 'audio';
    if (imageExts.includes(extension)) return 'image';
    if (docExts.includes(extension)) return 'document';
    if (codeExts.includes(extension)) return 'code';
    if (archiveExts.includes(extension)) return 'archive';
    
    return 'document';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (category: string) => {
    switch (category) {
      case 'video': return <Film className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'archive': return <Archive className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  }, []);

  const processFiles = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type,
      category: getFileCategory(file),
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
  };

  const retryFailedUploads = () => {
    setUploadedFiles(prev => 
      prev.map(file => 
        file.status === 'error' 
          ? { ...file, status: 'pending' as const, error: undefined, progress: 0 }
          : file
      )
    );
  };

  const uploadSingleFile = async (fileData: UploadedFile): Promise<boolean> => {
    try {
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileData.id ? { ...f, status: 'uploading' as const, progress: 0 } : f)
      );

      const formData = new FormData();
      formData.append('files', fileData.file);
      formData.append('file_type', selectedFileType);
      if (selectedFolder && selectedFolder !== 'root') {
        formData.append('custom_folder', selectedFolder);
      }

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadedFiles(prev => 
              prev.map(f => f.id === fileData.id ? { ...f, progress } : f)
            );
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            setUploadedFiles(prev => 
              prev.map(f => f.id === fileData.id ? { ...f, status: 'completed' as const, progress: 100 } : f)
            );
            resolve(true);
          } else {
            const errorMessage = `Upload failed: ${xhr.status}`;
            setUploadedFiles(prev => 
              prev.map(f => f.id === fileData.id ? { ...f, status: 'error' as const, error: errorMessage } : f)
            );
            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener('error', () => {
          const errorMessage = 'Network error occurred';
          setUploadedFiles(prev => 
            prev.map(f => f.id === fileData.id ? { ...f, status: 'error' as const, error: errorMessage } : f)
          );
          reject(new Error(errorMessage));
        });

        xhr.open('POST', '/upload');
        xhr.send(formData);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileData.id ? { ...f, status: 'error' as const, error: errorMessage } : f)
      );
      return false;
    }
  };

  const uploadAllFiles = async () => {
    if (!selectedFileType) {
      toast({
        title: "Error",
        description: "Please select a file type before uploading",
        variant: "destructive",
      });
      return;
    }

    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of pendingFiles) {
        await uploadSingleFile(file);
        // Add small delay between uploads
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast({
        title: "Success",
        description: `Uploaded ${pendingFiles.length} file(s) successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Some uploads failed. Check the file list for details.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !selectedFileType) {
      toast({
        title: "Error", 
        description: "Please enter folder name and select file type",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('folder_path', newFolderName.trim());
      formData.append('file_type', selectedFileType);

      const response = await fetch('/create_folder', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Folder "${newFolderName}" created successfully`,
        });
        setNewFolderName('');
        setIsCreateFolderOpen(false);
        refetchFolders();
      } else {
        throw new Error('Failed to create folder');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create folder',
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'error': return 'text-destructive';
      case 'uploading': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Check className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'uploading': return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
      default: return null;
    }
  };

  const totalFiles = uploadedFiles.length;
  const completedFiles = uploadedFiles.filter(f => f.status === 'completed').length;
  const failedFiles = uploadedFiles.filter(f => f.status === 'error').length;
  const pendingFiles = uploadedFiles.filter(f => f.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">
          Upload Media
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground px-4">
          Add your videos, images, audio files, and documents to your media library
        </p>
      </div>

      {/* Configuration Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            File Type
          </label>
          <Select value={selectedFileType} onValueChange={setSelectedFileType}>
            <SelectTrigger>
              <SelectValue placeholder="Select file type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
              <SelectItem value="code">Code Files</SelectItem>
              <SelectItem value="archive">Archives</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-foreground">
              Destination Folder
            </label>
            {selectedFileType && (
              <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-3 h-3 mr-1" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Folder</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Folder Name
                      </label>
                      <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Enter folder name..."
                        onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createFolder} className="flex-1">
                        Create Folder
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsCreateFolderOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination folder..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Root Directory</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.path || folder.name} value={folder.path || folder.name}>
                  <span style={{ paddingLeft: `${folder.depth * 16}px` }}>
                    {folder.display_name || folder.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors cursor-pointer mb-6 ${
          dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        
        <div className="text-center">
          <div className="w-12 sm:w-16 h-12 sm:h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <UploadIcon className="w-6 sm:w-8 h-6 sm:h-8 text-primary-foreground" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
            Drop files here or click to browse
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 px-4">
            Support for various file types up to 10GB each
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Film className="w-3 h-3 sm:w-4 sm:h-4" />
              Video
            </div>
            <div className="flex items-center gap-1">
              <Image className="w-3 h-3 sm:w-4 sm:h-4" />
              Image
            </div>
            <div className="flex items-center gap-1">
              <Music className="w-3 h-3 sm:w-4 sm:h-4" />
              Audio
            </div>
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              Document
            </div>
            <div className="flex items-center gap-1">
              <Archive className="w-3 h-3 sm:w-4 sm:h-4" />
              Archive
            </div>
          </div>
        </div>
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="bg-card/50 border border-border rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Upload Queue ({totalFiles} files)
              </h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="text-green-500">{completedFiles} completed</span>
                <span className="text-muted-foreground">{pendingFiles} pending</span>
                {failedFiles > 0 && (
                  <span className="text-destructive">{failedFiles} failed</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {failedFiles > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={retryFailedUploads}
                  disabled={isUploading}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry Failed
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAllFiles}
                disabled={isUploading}
              >
                <X className="w-3 h-3 mr-1" />
                Clear All
              </Button>
              <Button 
                onClick={uploadAllFiles}
                disabled={isUploading || pendingFiles === 0}
                size="sm"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-3 h-3 mr-1" />
                    Upload All ({pendingFiles})
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-accent/50 rounded-lg">
                <div className="text-primary flex-shrink-0">
                  {getFileIcon(file.category)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-foreground truncate text-sm sm:text-base">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getStatusIcon(file.status)}
                      <span className={`text-xs ${getStatusColor(file.status)}`}>
                        {file.status === 'pending' && 'Ready'}
                        {file.status === 'uploading' && `${file.progress}%`}
                        {file.status === 'completed' && 'Done'}
                        {file.status === 'error' && 'Failed'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                    <span>{file.size}</span>
                    <span className="capitalize">{file.category}</span>
                  </div>
                  
                  {file.status === 'uploading' && (
                    <Progress value={file.progress} className="mt-2 h-1" />
                  )}
                  
                  {file.status === 'error' && file.error && (
                    <p className="text-xs text-destructive mt-1">{file.error}</p>
                  )}
                </div>
                
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 rounded-full hover:bg-destructive/20 transition-colors flex-shrink-0"
                  disabled={file.status === 'uploading'}
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;