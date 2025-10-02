// src/components/DocumentViewer.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentViewerProps {
  isOpen: boolean;
  doc: {
    id: string;
    title: string;
    url: string;
    type: string;
  } | null;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  isOpen,
  doc,
  onClose,
}) => {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset state when document changes
  useEffect(() => {
    if (doc) {
      setZoom(100);
      setCurrentPage(1);
      setIsLoading(true);
      setError(null);
    }
  }, [doc?.id]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDownload = () => {
    if (doc?.url) {
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.title;
      link.click();
    }
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (!isOpen || !doc) return null;

  const isPDF = doc.type === 'document' && doc.url.toLowerCase().endsWith('.pdf');
  const isTextFile = ['txt', 'md', 'json', 'xml', 'csv'].some(ext => 
    doc.url.toLowerCase().endsWith(`.${ext}`)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <FileText className="w-6 h-6 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {doc.title}
            </h2>
            <p className="text-sm text-muted-foreground capitalize">
              {doc.type} Document
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls for PDFs */}
          {isPDF && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="text-foreground hover:text-primary"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="text-foreground hover:text-primary"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
              <div className="w-px h-6 bg-border mx-2" />
            </>
          )}

          {/* Download button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-foreground hover:text-primary"
          >
            <Download className="w-5 h-5" />
          </Button>

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-foreground hover:text-primary"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </Button>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-foreground hover:text-primary"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground">Loading document...</p>
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        )}

        {!error && (
          <>
            {/* PDF Viewer */}
            {isPDF && (
              <iframe
                src={`${doc.url}#page=${currentPage}&zoom=${zoom}`}
                className="w-full h-full bg-white rounded-lg shadow-2xl"
                style={{ maxWidth: '1200px' }}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError('Failed to load PDF. Try downloading instead.');
                }}
                title={doc.title}
              />
            )}

            {/* Text file viewer */}
            {isTextFile && (
              <iframe
                src={doc.url}
                className="w-full h-full bg-card rounded-lg shadow-2xl border border-border"
                style={{ maxWidth: '1200px' }}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError('Failed to load document. Try downloading instead.');
                }}
                title={doc.title}
              />
            )}

            {/* Fallback for other document types */}
            {!isPDF && !isTextFile && (
              <div className="text-center max-w-md">
                <FileText className="w-24 h-24 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Preview Not Available
                </h3>
                <p className="text-muted-foreground mb-6">
                  This document type cannot be previewed in the browser.
                  Download the file to view it.
                </p>
                <Button onClick={handleDownload} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download Document
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with page navigation for PDFs */}
      {isPDF && !isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 p-4 bg-black/50 backdrop-blur-sm border-t border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handlePageChange('prev')}
            disabled={currentPage <= 1}
            className="text-foreground hover:text-primary"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handlePageChange('next')}
            disabled={currentPage >= totalPages}
            className="text-foreground hover:text-primary"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;