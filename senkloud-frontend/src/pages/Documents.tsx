// src/pages/Documents.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService, MediaFile } from '../services/api';
import DocumentViewer from '../components/DocumentViewer';
import { 
  FileText, 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  Grid, 
  List, 
  Folder,
  Calendar,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface DocumentItem {
  id: string;
  title: string;
  url: string;
  type: string;
  extension: string;
  size: number;
  modified: string;
  folder: string;
  thumbnail?: string;
}

const Documents: React.FC = () => {
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    title: string;
    url: string;
    type: string;
  } | null>(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch documents
  const { 
    data: documentsResponse, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiService.getFiles({ type: 'document' }),
    refetchOnWindowFocus: false,
  });

  // Transform document data
  const transformDocument = useCallback((file: MediaFile): DocumentItem => {
    const baseTitle = file.filename.replace(/\.[^/.]+$/, '');
    const formattedTitle = baseTitle
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    const extension = file.filename.split('.').pop()?.toLowerCase() || 'unknown';

    return {
      id: file.relative_path,
      title: formattedTitle,
      url: apiService.getStreamUrl(file.relative_path),
      type: file.type,
      extension,
      size: file.size,
      modified: file.modified,
      folder: file.folder || 'Root',
      thumbnail: file.thumbnail
    };
  }, []);

  // Process all documents
  const allDocuments = useMemo(() => {
    if (!documentsResponse?.success) return [];
    return documentsResponse.data.map(transformDocument);
  }, [documentsResponse, transformDocument]);

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = allDocuments;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.folder.toLowerCase().includes(query) ||
        doc.extension.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allDocuments, searchQuery, sortBy, sortOrder]);

  // Group documents by folder
  const documentsByFolder = useMemo(() => {
    const grouped: Record<string, DocumentItem[]> = {};
    
    filteredAndSortedDocuments.forEach(doc => {
      const folder = doc.folder || 'Root';
      if (!grouped[folder]) {
        grouped[folder] = [];
      }
      grouped[folder].push(doc);
    });
    
    return grouped;
  }, [filteredAndSortedDocuments]);

  // Handle document click
  const handleDocumentClick = useCallback((doc: DocumentItem) => {
    setSelectedDocument({
      id: doc.id,
      title: doc.title,
      url: doc.url,
      type: doc.type,
    });
    setIsDocumentViewerOpen(true);
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  // Get icon for file extension
  const getExtensionIcon = (extension: string) => {
    const iconClass = "w-8 h-8";
    switch (extension.toLowerCase()) {
      case 'pdf':
        return <FileText className={`${iconClass} text-red-500`} />;
      case 'doc':
      case 'docx':
        return <FileText className={`${iconClass} text-blue-500`} />;
      case 'txt':
      case 'md':
        return <FileText className={`${iconClass} text-gray-500`} />;
      case 'xls':
      case 'xlsx':
        return <FileText className={`${iconClass} text-green-500`} />;
      case 'ppt':
      case 'pptx':
        return <FileText className={`${iconClass} text-orange-500`} />;
      default:
        return <FileText className={`${iconClass} text-gray-400`} />;
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Error Loading Documents</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Failed to load documents'}
          </p>
          <Button onClick={() => refetch()}>
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
          <h2 className="text-2xl font-bold text-foreground mb-2">Loading Documents</h2>
          <p className="text-muted-foreground">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Documents</h1>
          <p className="text-muted-foreground">
            Browse and view your document collection
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
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
              {filteredAndSortedDocuments.length} document{filteredAndSortedDocuments.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
          </div>
        </div>

        {/* Documents by Folder */}
        {Object.entries(documentsByFolder).length > 0 ? (
          Object.entries(documentsByFolder).map(([folder, documents]) => (
            <div key={folder} className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Folder className="w-6 h-6 text-primary" />
                  {folder === 'Root' ? 'Root Directory' : folder}
                </h2>
                <span className="text-muted-foreground text-sm">
                  {documents.length} file{documents.length !== 1 ? 's' : ''}
                </span>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="group cursor-pointer"
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden rounded-xl mb-2 bg-accent flex items-center justify-center border-2 border-border hover:border-primary transition-all">
                        {getExtensionIcon(doc.extension)}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                          <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded uppercase">
                          {doc.extension}
                        </div>
                      </div>
                      <h3 className="font-medium text-foreground text-sm line-clamp-2 group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatFileSize(doc.size)} • {formatDate(doc.modified)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent cursor-pointer transition-colors border border-border"
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <div className="flex-shrink-0">
                        {getExtensionIcon(doc.extension)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">{doc.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span className="uppercase">{doc.extension}</span>
                          <span>•</span>
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(doc.modified)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const link = document.createElement('a');
                          link.href = doc.url;
                          link.download = doc.title;
                          link.click();
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {searchQuery ? 'No Documents Found' : 'No Documents'}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchQuery 
                ? `No documents match "${searchQuery}". Try a different search term.`
                : 'Upload your first documents to get started.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Document Viewer */}
      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        document={selectedDocument}
        onClose={() => {
          setIsDocumentViewerOpen(false);
          setSelectedDocument(null);
        }}
      />
    </div>
  );
};

export default Documents;