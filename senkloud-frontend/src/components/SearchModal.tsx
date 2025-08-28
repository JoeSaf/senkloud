// src/components/SearchModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  X, 
  Play, 
  Film, 
  Image, 
  Music, 
  FileText, 
  Archive,
  Clock,
  Calendar,
  Folder,
  Filter,
  Loader2
} from 'lucide-react';
import { apiService, MediaFile } from '../services/api';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemSelect: (item: SearchResult) => void;
}

interface SearchResult {
  id: string;
  title: string;
  image: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'code' | 'archive';
  folder: string;
  size: string;
  modified: string;
  url: string;
  duration?: string;
  year?: string;
  genre?: string;
}

interface SearchFilters {
  type: string;
  folder: string;
  dateRange: string;
  sizeRange: string;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onItemSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    type: '',
    folder: '',
    dateRange: '',
    sizeRange: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Fetch all media files for searching
  const { data: mediaResponse, isLoading } = useQuery({
    queryKey: ['search-media'],
    queryFn: () => apiService.getFiles(),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video': return <Film className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'archive': return <Archive className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const transformMediaFile = (file: MediaFile): SearchResult => {
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
      type: file.type,
      folder: file.folder || 'Root',
      size: apiService.formatFileSize(file.size),
      modified: file.modified,
      url: apiService.getStreamUrl(file.relative_path),
      duration: file.type === 'video' ? 'Unknown' : undefined,
      year: new Date(file.modified).getFullYear().toString(),
      genre: file.type === 'video' ? 'Video' : file.type === 'audio' ? 'Audio' : 'Media',
    };
  };

  // Process and filter search results
  const searchResults = React.useMemo(() => {
    if (!mediaResponse?.success || !mediaResponse.data) return [];

    let results = mediaResponse.data.map(transformMediaFile);

    // Filter by search query
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase().trim();
      results = results.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.folder.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.type) {
      results = results.filter(item => item.type === filters.type);
    }

    if (filters.folder) {
      results = results.filter(item => item.folder === filters.folder);
    }

    if (filters.dateRange) {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      if (filters.dateRange !== '') {
        results = results.filter(item => new Date(item.modified) >= cutoffDate);
      }
    }

    if (filters.sizeRange) {
      results = results.filter(item => {
        const sizeInMB = parseFloat(item.size);
        const unit = item.size.split(' ')[1];
        let sizeInBytes = sizeInMB;
        
        if (unit === 'GB') sizeInBytes *= 1024;
        if (unit === 'TB') sizeInBytes *= 1024 * 1024;
        
        switch (filters.sizeRange) {
          case 'small': return sizeInBytes < 100; // < 100MB
          case 'medium': return sizeInBytes >= 100 && sizeInBytes < 1024; // 100MB - 1GB
          case 'large': return sizeInBytes >= 1024; // > 1GB
          default: return true;
        }
      });
    }

    // Sort by relevance (exact matches first, then by modification date)
    return results.sort((a, b) => {
      if (debouncedQuery.trim()) {
        const query = debouncedQuery.toLowerCase();
        const aExact = a.title.toLowerCase().includes(query);
        const bExact = b.title.toLowerCase().includes(query);
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      
      // Sort by modification date (newest first)
      return new Date(b.modified).getTime() - new Date(a.modified).getTime();
    });
  }, [mediaResponse, debouncedQuery, filters]);

  // Get unique folders for filter dropdown
  const uniqueFolders = React.useMemo(() => {
    if (!mediaResponse?.success || !mediaResponse.data) return [];
    
    const folders = new Set(mediaResponse.data.map(file => file.folder || 'Root'));
    return Array.from(folders).sort();
  }, [mediaResponse]);

  const handleItemClick = (item: SearchResult) => {
    onItemSelect(item);
    onClose();
    setSearchQuery('');
    setFilters({ type: '', folder: '', dateRange: '', sizeRange: '' });
  };

  const clearFilters = () => {
    setFilters({ type: '', folder: '', dateRange: '', sizeRange: '' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search your media library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-12 text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-accent"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'border-border hover:bg-accent'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {Object.values(filters).filter(v => v !== '').length}
                </Badge>
              )}
            </button>
          </div>
        </DialogHeader>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-6 py-4 border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">File Type</label>
                <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="document">Documents</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="archive">Archives</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Folder</label>
                <Select value={filters.folder} onValueChange={(value) => setFilters(prev => ({ ...prev, folder: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All folders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All folders</SelectItem>
                    {uniqueFolders.map(folder => (
                      <SelectItem key={folder} value={folder}>
                        <div className="flex items-center gap-2">
                          <Folder className="w-3 h-3" />
                          {folder}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Past week</SelectItem>
                    <SelectItem value="month">Past month</SelectItem>
                    <SelectItem value="year">Past year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">File Size</label>
                <Select value={filters.sizeRange} onValueChange={(value) => setFilters(prev => ({ ...prev, sizeRange: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any size</SelectItem>
                    <SelectItem value="small">Small (&lt; 100MB)</SelectItem>
                    <SelectItem value="medium">Medium (100MB - 1GB)</SelectItem>
                    <SelectItem value="large">Large (&gt; 1GB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {hasActiveFilters && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={clearFilters}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search Results */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading media library...</p>
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {debouncedQuery.trim() || hasActiveFilters ? 'No results found' : 'Start searching'}
                </h3>
                <p className="text-muted-foreground">
                  {debouncedQuery.trim() || hasActiveFilters 
                    ? 'Try adjusting your search query or filters'
                    : 'Enter a search term to find your media files'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 pt-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                  {debouncedQuery.trim() && ` for "${debouncedQuery}"`}
                </p>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-accent flex items-center justify-center flex-shrink-0">
                      {item.image !== '/placeholder.svg' ? (
                        <img 
                          src={item.image} 
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-muted-foreground">
                          {getFileIcon(item.type)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground truncate">
                          {item.title}
                        </h4>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getFileIcon(item.type)}
                          <span className="capitalize">{item.type}</span>
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Folder className="w-3 h-3" />
                          {item.folder}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.modified)}
                        </div>
                        <span>{item.size}</span>
                        {item.duration && item.duration !== 'Unknown' && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.duration}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Play className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchModal;