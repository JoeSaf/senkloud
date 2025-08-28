// src/pages/Gallery.tsx - Complete Enhanced Version
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import MediaCarousel from '../components/MediaCarousel';
import MediaPlayer from '../components/MediaPlayer';
import FolderThumbnailUpload from '../components/FolderThumbnailUpload';
import { apiService, MediaFile } from '../services/api';
import { 
  Cloud, 
  Play, 
  Info, 
  Loader2, 
  AlertCircle, 
  Folder, 
  ChevronRight,
  Upload as UploadIcon,
  Settings,
  Search,
  Filter,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Calendar,
  Clock,
  Eye,
  Star,
  Download
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import heroBg from '../assets/hero-bg.png';

interface MediaItem {
  id: string;
  title: string;
  image: string;
  duration?: string;
  year?: string;
  genre?: string;
  type?: string;
  url?: string;
  folder?: string;
  size?: number;
  modified?: string;
  thumbnail?: string;
}

const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [featuredMedia, setFeaturedMedia] = useState<MediaItem | null>(null);
  const [folderThumbnails, setFolderThumbnails] = useState<{[key: string]: string}>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showThumbnailUpload, setShowThumbnailUpload] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  const libraryRef = useRef<HTMLDivElement>(null);

  // Mobile detection and player navigation hook
  const useMediaPlayerNavigation = () => {
    const isMobileDevice = useCallback(() => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
             (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
             window.innerWidth <= 768;
    }, []);

    const openMediaPlayer = useCallback((mediaItem: MediaItem) => {
      if (isMobileDevice()) {
        // Navigate to dedicated player page for mobile
        const params = new URLSearchParams({
          url: mediaItem.url || '',
          title: mediaItem.title,
          type: mediaItem.type || 'video',
          poster: mediaItem.image !== '/placeholder.svg' ? mediaItem.image : ''
        });
        
        navigate(`/player?${params.toString()}`);
      } else {
        // Use modal player for desktop
        setSelectedMedia(mediaItem);
        setIsPlayerOpen(true);
      }
    }, [navigate, isMobileDevice]);

    return { openMediaPlayer, isMobileDevice };
  };

  const { openMediaPlayer } = useMediaPlayerNavigation();

  // Load folder thumbnails from localStorage
  useEffect(() => {
    try {
      const savedThumbnails = localStorage.getItem('folderThumbnails');
      if (savedThumbnails) {
        setFolderThumbnails(JSON.parse(savedThumbnails));
      }
    } catch (error) {
      console.error('Error loading folder thumbnails:', error);
    }
  }, []);

  // Fetch all media files
  const { 
    data: mediaResponse, 
    isLoading: mediaLoading, 
    error: mediaError,
    refetch: refetchMedia 
  } = useQuery({
    queryKey: ['media-files'],
    queryFn: () => apiService.getFiles(),
    refetchOnWindowFocus: false,
  });

  const isLoading = mediaLoading;
  const error = mediaError;

  // Fetch video info for enhanced metadata
  const fetchVideoInfo = useCallback(async (item: MediaItem) => {
    if (item.type === 'video' && item.url) {
      try {
        const filename = item.url.split('/stream/')[1];
        if (filename) {
          const response = await fetch(`/api/video-info/${filename}`);
          const data = await response.json();
          const secs = parseFloat(data.duration_seconds || data.duration || 0);
          const enhancedItem = {
            ...item,
            duration: secs > 0 
              ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
              : item.duration,
          };
          // Only update if the selected media is still the same item
          setSelectedMedia(current => current?.id === item.id ? enhancedItem : current);
        }
      } catch (error) {
        console.error('Error fetching video info:', error);
      }
    }
  }, []);

  // Transform backend data to frontend format with folder thumbnails
  const transformMediaFile = useCallback((file: MediaFile): MediaItem => {
    const baseTitle = file.filename.replace(/\.[^/.]+$/, '');
    const formattedTitle = baseTitle
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    // Extract directory from file path for folder thumbnail
    const pathParts = file.relative_path.split('/');
    const directory = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : 'Root';
    const folderThumbnail = folderThumbnails[directory];

    return {
      id: file.relative_path,
      title: formattedTitle,
      image: folderThumbnail || (file.thumbnail 
        ? apiService.getThumbnailUrl(file.thumbnail)
        : '/placeholder.svg'),
      duration: file.type === 'video' ? 'Unknown' : undefined,
      year: new Date(file.modified).getFullYear().toString(),
      genre: file.type === 'video' ? 'Video' : file.type === 'audio' ? 'Audio' : 'Image',
      type: file.type,
      url: apiService.getStreamUrl(file.relative_path),
      folder: file.folder || 'Root',
      size: file.size,
      modified: file.modified,
      thumbnail: file.thumbnail
    };
  }, [folderThumbnails]);

  // Process all media data
  const allMedia = useMemo(() => {
    if (!mediaResponse?.success) return [];
    return mediaResponse.data.map(transformMediaFile);
  }, [mediaResponse, transformMediaFile]);

  // Filter and sort media
  const filteredAndSortedMedia = useMemo(() => {
    let filtered = allMedia;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.folder?.toLowerCase().includes(query) ||
        item.type?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
          comparison = new Date(a.modified || 0).getTime() - new Date(b.modified || 0).getTime();
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = (a.type || '').localeCompare(b.type || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allMedia, searchQuery, filterType, sortBy, sortOrder]);

  // Group media by directory
  const mediaByDirectory = useMemo(() => {
    const grouped: Record<string, Record<string, MediaItem[]>> = {};
    
    filteredAndSortedMedia.forEach(item => {
      const directory = item.folder || 'Root';
      const type = item.type || 'unknown';
      
      if (!grouped[directory]) {
        grouped[directory] = {};
      }
      if (!grouped[directory][type]) {
        grouped[directory][type] = [];
      }
      
      grouped[directory][type].push(item);
    });
    
    return grouped;
  }, [filteredAndSortedMedia]);

  // Recent items (videos only)
  const recentItems = useMemo(() => {
    return allMedia
      .filter(item => item.type === 'video') // Only videos for recently added
      .sort((a, b) => new Date(b.modified || 0).getTime() - new Date(a.modified || 0).getTime())
      .slice(0, 12);
  }, [allMedia]);

  // Set featured media
  useEffect(() => {
    if (!featuredMedia && recentItems.length > 0) {
      setFeaturedMedia(recentItems[0]);
    }
  }, [recentItems, featuredMedia]);

  // Handle media item click
  const handleItemClick = useCallback((item: MediaItem) => {
    // Fetch video info if it's a video
    if (item.type === 'video' && item.url) {
      fetchVideoInfo(item);
    }
    
    // Open player using mobile-aware navigation
    openMediaPlayer(item);
  }, [fetchVideoInfo, openMediaPlayer]);

  // Handle featured media play
  const handleFeaturedPlay = useCallback(() => {
    if (featuredMedia) {
      openMediaPlayer(featuredMedia);
    }
  }, [featuredMedia, openMediaPlayer]);

  // Handle browse library
  const handleBrowseLibrary = useCallback(() => {
    if (libraryRef.current) {
      libraryRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Handle thumbnail upload
  const handleThumbnailUploaded = useCallback((directory: string, thumbnailUrl: string) => {
    const newThumbnails = {
      ...folderThumbnails,
      [directory]: thumbnailUrl
    };
    setFolderThumbnails(newThumbnails);
    
    try {
      localStorage.setItem('folderThumbnails', JSON.stringify(newThumbnails));
      toast({
        title: "Success",
        description: "Folder thumbnail updated successfully",
      });
    } catch (error) {
      console.error('Error saving folder thumbnails:', error);
      toast({
        title: "Warning",
        description: "Thumbnail updated but failed to save to local storage",
        variant: "destructive",
      });
    }
    
    refetchMedia();
  }, [folderThumbnails, refetchMedia]);

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  // Get icon for file type
  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'video': return <Play className="w-4 h-4" />;
      case 'audio': return <span className="text-center text-sm">♫</span>;
      case 'image': return <span className="text-center text-sm">🖼</span>;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Error Loading Media</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Failed to load media files'}
          </p>
          <Button onClick={() => refetchMedia()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Loading Your Media</h2>
          <p className="text-muted-foreground">Please wait while we fetch your content...</p>
        </div>
      </div>
    );
  }

  const lastWatchedMedia = null; // TODO: Implement last watched tracking
  const mostRecentMedia = recentItems[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div 
        className="relative min-h-[60vh] sm:min-h-[70vh] lg:min-h-[80vh] flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${featuredMedia?.image || heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4 sm:px-6">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 sm:mb-6">
            {featuredMedia ? featuredMedia.title : mostRecentMedia ? 
              mostRecentMedia.title : 'Recently Added Media'}
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-200 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
            {lastWatchedMedia 
              ? `Continue watching: ${lastWatchedMedia.title}`
              : 'Your personal media streaming platform. Upload, organize, and enjoy your content anywhere.'
            }
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            {featuredMedia && (
              <button 
                onClick={handleFeaturedPlay}
                className="flex items-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                Play Now
              </button>
            )}
            <button 
              onClick={handleBrowseLibrary}
              className="flex items-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors backdrop-blur-sm"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
              Browse Library
            </button>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div ref={libraryRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Controls Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter by type */}
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort options */}
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort order */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>

              {/* View mode */}
              <div className="flex rounded-lg border">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Results summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filteredAndSortedMedia.length} items 
              {searchQuery && ` matching "${searchQuery}"`}
              {filterType !== 'all' && ` in ${filterType}`}
            </span>
            <Link
              to="/upload"
              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
            >
              <UploadIcon className="w-4 h-4" />
              Upload Media
            </Link>
          </div>
        </div>

        {/* Recent Items */}
        {recentItems.length > 0 && searchQuery === '' && filterType === 'all' && (
          <div className="mb-12">
            <MediaCarousel
              title="Recently Added"
              items={recentItems}
              onItemClick={handleItemClick}
            />
          </div>
        )}

        {/* Directory-based Categories or Flat View */}
        {searchQuery || filterType !== 'all' ? (
          // Flat view for search/filter results
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Search Results ({filteredAndSortedMedia.length})
            </h2>
            
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredAndSortedMedia.map((item) => (
                  <div
                    key={item.id}
                    className="group cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl mb-2">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                      <div className="absolute top-2 left-2 text-white">
                        {getTypeIcon(item.type)}
                      </div>
                      {item.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                          {item.duration}
                        </div>
                      )}
                    </div>
                    <h3 className="font-medium text-foreground text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(item.modified)} • {formatFileSize(item.size)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAndSortedMedia.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="w-16 h-12 flex-shrink-0 rounded overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {getTypeIcon(item.type)}
                        <span className="capitalize">{item.type}</span>
                        <span>•</span>
                        <span>{formatDate(item.modified)}</span>
                        <span>•</span>
                        <span>{formatFileSize(item.size)}</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.duration}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Directory-based view
          Object.entries(mediaByDirectory).map(([directory, typeGroups]) => (
            <div key={directory} className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                  <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  {directory === 'Root' ? 'Root Directory' : directory}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDirectory(directory);
                    setShowThumbnailUpload(true);
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Customize
                </Button>
              </div>

              {/* Type subcategories within directory */}
              {Object.entries(typeGroups).map(([type, items]) => (
                <div key={`${directory}-${type}`} className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground capitalize flex items-center gap-2">
                      {getTypeIcon(type)}
                      {type}s ({items.length})
                    </h3>
                    
                    {items.length > 6 && (
                      <Link
                        to={`/browse/${type}?folder=${encodeURIComponent(directory === 'Root' ? '' : directory)}`}
                        className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors text-sm"
                      >
                        View All
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>

                  {/* Show first 6 items */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {items.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        className="group cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="relative aspect-[2/3] overflow-hidden rounded-xl mb-2">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/placeholder.svg';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                            <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                          {item.duration && (
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                              {item.duration}
                            </div>
                          )}
                        </div>
                        <h3 className="font-medium text-foreground text-sm line-clamp-2 group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.year} • {item.genre}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {/* Empty state */}
        {filteredAndSortedMedia.length === 0 && (
          <div className="text-center py-16">
            <Cloud className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {searchQuery ? 'No Results Found' : 'No Media Files'}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchQuery 
                ? `No media files match "${searchQuery}". Try a different search term.`
                : 'Upload your first media files to get started with your personal streaming platform.'
              }
            </p>
            {!searchQuery && (
              <Link to="/upload">
                <Button>
                  <UploadIcon className="w-4 h-4 mr-2" />
                  Upload Media
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Folder Thumbnail Upload Modal */}
      {showThumbnailUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Customize Folder Thumbnail</h3>
            <FolderThumbnailUpload
              folderPath={selectedDirectory}
              fileType="video"
              onThumbnailUploaded={(folder, url) => {
                handleThumbnailUploaded(folder, url);
                setShowThumbnailUpload(false);
              }}
              existingThumbnail={folderThumbnails[selectedDirectory]}
            />
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowThumbnailUpload(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Modal Media Player */}
      <MediaPlayer
        isOpen={isPlayerOpen}
        onClose={() => {
          setIsPlayerOpen(false);
          setSelectedMedia(null);
        }}
        media={selectedMedia}
        nextEpisode={null} // TODO: Implement episode navigation
        onNextEpisode={() => {}} // TODO: Implement next episode handler
        recommendedMedia={recentItems.slice(0, 6)}
        onRecommendedSelect={(media) => {
          setSelectedMedia(media);
          if (media.type === 'video' && media.url) {
            fetchVideoInfo(media);
          }
        }}
      />
    </div>
  );
};

export default Gallery;