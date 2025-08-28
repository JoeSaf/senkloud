// src/pages/FolderView.tsx
import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Grid, List, Play, Image, Music, Film, Loader2, AlertCircle } from 'lucide-react';
import { apiService, MediaFile } from '../services/api';
import MediaPlayer from '../components/MediaPlayer';
import { toast } from '@/hooks/use-toast';

interface MediaItem {
  id: string;
  title: string;
  image: string;
  duration?: string;
  year?: string;
  genre?: string;
  type?: string;
  url?: string;
  size?: string;
  modified?: string;
}

const FolderView: React.FC = () => {
  const { type, folder } = useParams<{ type: string; folder?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Get folder from URL params or search params
  const folderParam = folder || searchParams.get('folder') || '';
  const decodedFolder = folderParam ? decodeURIComponent(folderParam) : '';

  // Fetch folder contents
  const { 
    data: mediaResponse, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['folder-contents', type, decodedFolder],
    queryFn: () => apiService.getFiles({ type, folder: decodedFolder }),
    refetchOnWindowFocus: false,
  });

  const transformMediaFile = (file: MediaFile): MediaItem => {
    const baseTitle = file.filename.replace(/\.[^/.]+$/, '');
    const formattedTitle = baseTitle
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    return {
      id: file.relative_path,
      title: formattedTitle,
      image: file.thumbnail 
        ? apiService.getThumbnailUrl(file.thumbnail)
        : '/placeholder.svg',
      duration: file.type === 'video' ? 'Unknown' : undefined,
      year: new Date(file.modified).getFullYear().toString(),
      genre: file.type === 'video' ? 'Video' : file.type === 'audio' ? 'Audio' : 'Media',
      type: file.type,
      url: apiService.getStreamUrl(file.relative_path),
      size: apiService.formatFileSize(file.size),
      modified: file.modified,
    };
  };

  const mediaFiles = mediaResponse?.success ? mediaResponse.data || [] : [];
  const transformedFiles = mediaFiles.map(transformMediaFile);

  const handleItemClick = async (item: MediaItem) => {
    if (item.type === 'video') {
      try {
        const videoInfo = await apiService.getVideoInfo(item.id);
        if (videoInfo.success && videoInfo.data) {
          const secs = Number((videoInfo.data as any).duration ?? 0);
          const enhancedItem = {
            ...item,
            duration: secs > 0 
              ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
              : item.duration,
          };
          setSelectedMedia(enhancedItem);
        } else {
          setSelectedMedia(item);
        }
      } catch (error) {
        console.error('Error fetching video info:', error);
        setSelectedMedia(item);
      }
    } else {
      setSelectedMedia(item);
    }
    
    setIsPlayerOpen(true);
  };

  const getTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'video': return <Film className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      default: return <Play className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading folder contents...</p>
        </div>
      </div>
    );
  }

  if (error || !mediaResponse?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Failed to Load Folder
          </h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading the folder contents.
          </p>
          <button onClick={() => refetch()} className="btn-primary mr-3">
            Retry
          </button>
          <button onClick={() => navigate('/')} className="btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back to Gallery
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {decodedFolder ? decodedFolder.replace(/\//g, ' → ') : `All ${type?.charAt(0).toUpperCase()}${type?.slice(1)}`}
              </h1>
              <p className="text-muted-foreground">
                {transformedFiles.length} {transformedFiles.length === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {transformedFiles.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              {getTypeIcon(type || 'video')}
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Files Found
            </h3>
            <p className="text-muted-foreground mb-6">
              This folder appears to be empty.
            </p>
            <Link to="/upload" className="btn-primary">
              Upload Files
            </Link>
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                {transformedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="media-card group cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-12 h-12 primary-gradient rounded-full flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                          <Play className="w-5 h-5 text-primary-foreground ml-1" />
                        </div>
                      </div>

                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded-lg text-xs text-white flex items-center gap-1">
                        {getTypeIcon(item.type || 'video')}
                      </div>
                    </div>

                    <div className="p-3">
                      <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors text-sm">
                        {item.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.size}</span>
                        <span>{item.year}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="card-gradient rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-accent/50">
                      <tr>
                        <th className="text-left p-4 text-muted-foreground font-medium">Name</th>
                        <th className="text-left p-4 text-muted-foreground font-medium">Type</th>
                        <th className="text-left p-4 text-muted-foreground font-medium">Size</th>
                        <th className="text-left p-4 text-muted-foreground font-medium">Modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transformedFiles.map((item) => (
                        <tr 
                          key={item.id} 
                          className="border-b border-border/20 hover:bg-accent/20 cursor-pointer transition-colors"
                          onClick={() => handleItemClick(item)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-accent flex items-center justify-center">
                                {item.image !== '/placeholder.svg' ? (
                                  <img 
                                    src={item.image} 
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  getTypeIcon(item.type || 'video')
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{item.title}</p>
                                <p className="text-sm text-muted-foreground">{item.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(item.type || 'video')}
                              <span className="capitalize text-muted-foreground">
                                {item.type}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">{item.size}</td>
                          <td className="p-4 text-muted-foreground">
                            {item.modified ? formatDate(item.modified) : 'Unknown'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Media Player Modal */}
      <MediaPlayer
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        media={selectedMedia}
      />
    </div>
  );
};

export default FolderView;