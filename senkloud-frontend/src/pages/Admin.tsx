import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Users, Film, HardDrive, Settings, Trash2, RefreshCw, Eye, FolderPlus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiService, MediaFile } from '../services/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface AdminStats {
  users?: number;
  files?: {
    total: number;
    by_type: {
      image: number;
      video: number;
      audio: number;
      document?: number;
      code?: number;
      archive?: number;
    };
  };
  storage?: {
    total_bytes: number;
    by_type: {
      image: number;
      video: number;
      audio: number;
      document?: number;
      code?: number;
      archive?: number;
    };
  };
  folders?: {
    image: number;
    video: number;
    audio: number;
  };
  thumbnails?: number;
}

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'media' | 'settings'>('overview');
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [isCleaningThumbnails, setIsCleaningThumbnails] = useState(false);
  const queryClient = useQueryClient();

  // Fetch admin stats
  const { 
    data: statsResponse, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats 
  } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiService.getAdminStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all media files for media management
  const { 
    data: mediaResponse, 
    isLoading: mediaLoading,
    refetch: refetchMedia 
  } = useQuery({
    queryKey: ['admin-media'],
    queryFn: () => apiService.getFiles(),
    refetchInterval: 60000, // Refresh every minute
  });

  // Refresh Jellyfin mutation
  const refreshJellyfinMutation = useMutation({
    mutationFn: () => apiService.refreshJellyfin(),
    onSuccess: (response) => {
      if (response.success) {
        toast({
          title: "Jellyfin Refreshed",
          description: "Jellyfin library has been refreshed successfully.",
        });
      } else {
        toast({
          title: "Refresh Failed",
          description: response.error || "Failed to refresh Jellyfin library.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Error communicating with Jellyfin.",
        variant: "destructive",
      });
    },
  });

  // Generate thumbnails mutation
  const generateThumbnailsMutation = useMutation({
    mutationFn: () => apiService.generateThumbnails(),
    onMutate: () => {
      setIsGeneratingThumbnails(true);
    },
    onSuccess: (response) => {
      if (response.success) {
        toast({
          title: "Thumbnails Generated",
          description: `Generated ${response.data?.generated || 0} thumbnails.`,
        });
        refetchStats();
        refetchMedia();
      } else {
        toast({
          title: "Generation Failed",
          description: response.error || "Failed to generate thumbnails.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Error generating thumbnails.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGeneratingThumbnails(false);
    },
  });

  // Cleanup thumbnails mutation
  const cleanupThumbnailsMutation = useMutation({
    mutationFn: () => apiService.cleanupThumbnails(),
    onMutate: () => {
      setIsCleaningThumbnails(true);
    },
    onSuccess: (response) => {
      if (response.success) {
        toast({
          title: "Thumbnails Cleaned",
          description: `Removed ${response.data?.removed || 0} orphaned thumbnails.`,
        });
        refetchStats();
      } else {
        toast({
          title: "Cleanup Failed",
          description: response.error || "Failed to cleanup thumbnails.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Cleanup Failed",
        description: "Error cleaning up thumbnails.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsCleaningThumbnails(false);
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: (filename: string) => apiService.deleteFile(filename),
    onSuccess: (response, filename) => {
      if (response.success) {
        toast({
          title: "File Deleted",
          description: `${filename} has been deleted successfully.`,
        });
        refetchMedia();
        refetchStats();
      } else {
        toast({
          title: "Delete Failed",
          description: response.error || "Failed to delete file.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Error deleting file.",
        variant: "destructive",
      });
    },
  });

  const stats: AdminStats = statsResponse?.success ? statsResponse.data : {};
  const mediaFiles: MediaFile[] = mediaResponse?.success ? mediaResponse.data || [] : [];

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video': return <Film className="w-4 h-4" />;
      case 'image': return '🖼️';
      case 'audio': return '🎵';
      case 'document': return '📄';
      case 'code': return '💻';
      case 'archive': return '📦';
      default: return '📄';
    }
  };

  const getStatusBadge = (status: string) => {
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  };

  const statsCards = [
    { 
      label: 'Total Media', 
      value: stats.files?.total?.toString() || '0', 
      icon: Film, 
      color: 'text-blue-400' 
    },
    { 
      label: 'Storage Used', 
      value: stats.storage?.total_bytes ? formatFileSize(stats.storage.total_bytes) : '0 B', 
      icon: HardDrive, 
      color: 'text-yellow-400' 
    },
    { 
      label: 'Total Folders', 
      value: stats.folders ? (stats.folders.image + stats.folders.video + stats.folders.audio).toString() : '0', 
      icon: FolderPlus, 
      color: 'text-green-400' 
    },
    { 
      label: 'Thumbnails', 
      value: stats.thumbnails?.toString() || '0', 
      icon: BarChart3, 
      color: 'text-purple-400' 
    },
  ];

  const renderOverview = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statsCards.map((stat, index) => (
          <div key={index} className="card-gradient rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs sm:text-sm">{stat.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : stat.value}
                </p>
              </div>
              <div className={`p-2 sm:p-3 rounded-lg bg-accent ${stat.color}`}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* File Type Breakdown */}
      {stats.files && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-gradient rounded-xl p-6">
            <h3 className="text-xl font-semibold text-foreground mb-4">Files by Type</h3>
            <div className="space-y-3">
              {Object.entries(stats.files.by_type).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFileIcon(type)}
                    <span className="capitalize text-foreground">{type}</span>
                  </div>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-gradient rounded-xl p-6">
            <h3 className="text-xl font-semibold text-foreground mb-4">Storage by Type</h3>
            <div className="space-y-3">
              {stats.storage && Object.entries(stats.storage.by_type).map(([type, bytes]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFileIcon(type)}
                    <span className="capitalize text-foreground">{type}</span>
                  </div>
                  <span className="text-muted-foreground">{formatFileSize(bytes)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Actions */}
      <div className="card-gradient rounded-xl p-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">System Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            onClick={() => refreshJellyfinMutation.mutate()}
            disabled={refreshJellyfinMutation.isPending}
            className="flex items-center gap-2"
          >
            {refreshJellyfinMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh Jellyfin
          </Button>

          <Button 
            onClick={() => generateThumbnailsMutation.mutate()}
            disabled={isGeneratingThumbnails}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isGeneratingThumbnails ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Generate Thumbnails
          </Button>

          <Button 
            onClick={() => cleanupThumbnailsMutation.mutate()}
            disabled={isCleaningThumbnails}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isCleaningThumbnails ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Cleanup Thumbnails
          </Button>

          <Button 
            onClick={() => {
              refetchStats();
              refetchMedia();
              toast({
                title: "Data Refreshed",
                description: "Admin data has been refreshed.",
              });
            }}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>
      </div>
    </div>
  );

  const renderMedia = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-foreground">Media Library ({mediaFiles.length} files)</h3>
        <Button 
          onClick={() => refetchMedia()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {mediaLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="card-gradient rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/50">
                <tr>
                  <th className="text-left p-4 text-muted-foreground font-medium">Media</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Type</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Size</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Folder</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Modified</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mediaFiles.slice(0, 50).map((file) => ( // Show first 50 files
                  <tr key={file.relative_path} className="border-b border-border/20">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {file.thumbnail ? (
                          <img 
                            src={apiService.getThumbnailUrl(file.thumbnail)} 
                            alt={file.filename}
                            className="w-12 h-16 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-12 h-16 bg-accent rounded-lg flex items-center justify-center">
                            {getFileIcon(file.type)}
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-foreground block">{file.filename}</span>
                          <span className="text-xs text-muted-foreground">{file.relative_path}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="capitalize text-muted-foreground flex items-center gap-2">
                        {getFileIcon(file.type)}
                        {file.type}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">{formatFileSize(file.size)}</td>
                    <td className="p-4 text-muted-foreground">{file.folder || 'Root'}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(file.modified).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(apiService.getStreamUrl(file.relative_path), '_blank')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete File</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p>Are you sure you want to delete "{file.filename}"? This action cannot be undone.</p>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline">Cancel</Button>
                                <Button 
                                  variant="destructive"
                                  onClick={() => deleteFileMutation.mutate(file.relative_path)}
                                  disabled={deleteFileMutation.isPending}
                                >
                                  {deleteFileMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  ) : null}
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mediaFiles.length > 50 && (
            <div className="p-4 text-center text-muted-foreground">
              Showing first 50 of {mediaFiles.length} files
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-foreground">System Information</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-gradient rounded-xl p-6">
          <h4 className="text-lg font-medium text-foreground mb-4">System Stats</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Files:</span>
              <span className="text-foreground">{stats.files?.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Storage:</span>
              <span className="text-foreground">{stats.storage?.total_bytes ? formatFileSize(stats.storage.total_bytes) : '0 B'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Folders:</span>
              <span className="text-foreground">{stats.folders ? (stats.folders.image + stats.folders.video + stats.folders.audio) : 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thumbnails Generated:</span>
              <span className="text-foreground">{stats.thumbnails || 0}</span>
            </div>
          </div>
        </div>

        <div className="card-gradient rounded-xl p-6">
          <h4 className="text-lg font-medium text-foreground mb-4">Quick Actions</h4>
          <div className="space-y-3">
            <Button 
              onClick={() => refetchStats()}
              className="w-full justify-start"
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Statistics
            </Button>
            <Button 
              onClick={() => generateThumbnailsMutation.mutate()}
              className="w-full justify-start"
              variant="outline"
              disabled={isGeneratingThumbnails}
            >
              {isGeneratingThumbnails ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Regenerate All Thumbnails
            </Button>
            <Button 
              onClick={() => cleanupThumbnailsMutation.mutate()}
              className="w-full justify-start"
              variant="outline"
              disabled={isCleaningThumbnails}
            >
              {isCleaningThumbnails ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Clean Orphaned Thumbnails
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'media', label: 'Media', icon: Film },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (statsError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Failed to Load Admin Data
          </h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading the admin dashboard.
          </p>
          <Button onClick={() => refetchStats()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">Admin Dashboard</h1>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
          Manage your media server and monitor system performance
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 sm:mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'media' && renderMedia()}
      {activeTab === 'settings' && renderSettings()}
    </div>
  );
};

export default Admin;