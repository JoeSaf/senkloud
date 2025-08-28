import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiService } from '../services/api';

interface FolderThumbnailData {
  thumbnail_url: string;
  inherit_to_children: boolean;
  uploaded_at: string;
  thumbnail_filename?: string;
}

interface FolderThumbnailUploadProps {
  folderPath: string;
  fileType: string;
  onThumbnailUploaded: (folderPath: string, thumbnailUrl: string) => void;
  onClose?: () => void;
  existingThumbnail?: string;
}

const FolderThumbnailUpload: React.FC<FolderThumbnailUploadProps> = ({
  folderPath,
  fileType,
  onThumbnailUploaded,
  onClose,
  existingThumbnail
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingThumbnail || null);
  const [isUploading, setIsUploading] = useState(false);
  const [inheritToChildren, setInheritToChildren] = useState(false);
  const [thumbnailData, setThumbnailData] = useState<FolderThumbnailData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingThumbnail) {
      setPreviewUrl(existingThumbnail);
    }
  }, [existingThumbnail]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    const handleUpload = async () => {
      try {
        // Create FormData for upload
        const formData = new FormData();
        formData.append('thumbnail', file);
        formData.append('folder_path', folderPath);
        formData.append('file_type', fileType);
        formData.append('inherit_to_children', inheritToChildren.toString());

        // Upload to backend using fetch with better error handling
        const result = await apiService.uploadFolderThumbnail(
          file,
          folderPath,
          fileType,
          inheritToChildren
        );

        if (result.success && result.thumbnail_url) {
          setPreviewUrl(result.thumbnail_url);
          setThumbnailData({
            thumbnail_url: result.thumbnail_url,
            inherit_to_children: inheritToChildren,
            uploaded_at: new Date().toISOString()
          });

          onThumbnailUploaded(folderPath, result.thumbnail_url);

          toast({
            title: "Thumbnail uploaded",
            description: `Custom thumbnail set for ${folderPath === 'Root' ? 'root directory' : folderPath}${inheritToChildren ? ' (will inherit to subfolders)' : ''}`,
          });
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      } catch (error) {
        console.error('Error uploading thumbnail:', error);
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Failed to upload thumbnail. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsUploading(false);
      }
    };

    handleUpload();
  };

  const handleRemoveThumbnail = async () => {
    try {
      const result = await apiService.deleteFolderThumbnail(folderPath, fileType);

      if (result.success) {
        setPreviewUrl(null);
        setThumbnailData(null);
        setInheritToChildren(false);
        onThumbnailUploaded(folderPath, '');
        
        toast({
          title: "Thumbnail removed",
          description: `Custom thumbnail removed for ${folderPath === 'Root' ? 'root directory' : folderPath}`,
        });
      } else {
        throw new Error(result?.error || 'Failed to remove thumbnail');
      }
    } catch (error) {
      console.error('Error removing thumbnail:', error);
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Failed to remove thumbnail. Please try again.",
        variant: "destructive"
      });
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Folder Thumbnail
          </CardTitle>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {folderPath === 'Root' ? 'Root Directory' : folderPath}
          <span className="ml-1 text-xs bg-secondary px-1.5 py-0.5 rounded">
            {fileType}
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thumbnail Preview */}
        <div className="space-y-2">
          <Label>Current Thumbnail</Label>
          <div className="relative w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg overflow-hidden">
            {previewUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={previewUrl}
                  alt={`Custom thumbnail for ${folderPath}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveThumbnail}
                  className="absolute top-2 right-2 h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">No custom thumbnail</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Section */}
        <div className="space-y-2">
          <Label>Upload New Thumbnail</Label>
          <div className="flex items-center space-x-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={triggerFileSelect}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Image
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Inheritance Option */}
        <div className="flex items-center space-x-2">
          <Switch
            id="inherit-thumbnail"
            checked={inheritToChildren}
            onCheckedChange={setInheritToChildren}
            disabled={isUploading}
          />
          <Label htmlFor="inherit-thumbnail" className="text-sm">
            Apply to subfolders
          </Label>
        </div>

        {/* Thumbnail Info */}
        {thumbnailData && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Uploaded: {new Date(thumbnailData.uploaded_at).toLocaleDateString()}</p>
            {thumbnailData.inherit_to_children && (
              <p className="text-blue-600">✓ Inherits to subfolders</p>
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground">
          <p>• Supported formats: JPG, PNG, GIF, WebP</p>
          <p>• Maximum size: 5MB</p>
          <p>• Recommended: Square images work best</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FolderThumbnailUpload;