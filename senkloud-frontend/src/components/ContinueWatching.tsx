// src/components/ContinueWatching.tsx
import React, { useState, useEffect } from 'react';
import { Play, X } from 'lucide-react';
import { watchHistoryService, WatchHistoryItem } from '../services/watchHistory';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ContinueWatchingProps {
  onMediaSelect: (item: WatchHistoryItem) => void;
  limit?: number;
}

const ContinueWatching: React.FC<ContinueWatchingProps> = ({ 
  onMediaSelect,
  limit = 10 
}) => {
  const [recentlyWatched, setRecentlyWatched] = useState<WatchHistoryItem[]>([]);

  useEffect(() => {
    loadRecentlyWatched();
    
    // Listen for storage events to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'senkloud_watch_history') {
        loadRecentlyWatched();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [limit]);

  const loadRecentlyWatched = () => {
    const items = watchHistoryService.getRecentlyWatched(limit);
    setRecentlyWatched(items);
  };

  const handleRemoveItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    watchHistoryService.removeItem(itemId);
    loadRecentlyWatched();
  };

  const handleResumeClick = (item: WatchHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    onMediaSelect(item);
  };

  if (recentlyWatched.length === 0) {
    return null;
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Continue Watching
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Clear all watch history?')) {
              watchHistoryService.clearHistory();
              loadRecentlyWatched();
            }
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          Clear All
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {recentlyWatched.map((item) => (
          <Card
            key={item.id}
            className="group relative overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-300 cursor-pointer"
            onClick={() => onMediaSelect(item)}
          >
            <CardContent className="p-0">
              {/* Thumbnail */}
              <div className="relative aspect-[2/3] overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                
                {/* Progress bar at bottom of image */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2">
                  <Progress value={item.percentage} className="h-1 mb-1" />
                  <div className="flex items-center justify-between text-xs text-white">
                    <span>{watchHistoryService.formatTime(item.currentTime)}</span>
                    <span>{Math.round(item.percentage)}%</span>
                  </div>
                </div>

                {/* Hover overlay with resume button */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <Button
                    size="lg"
                    className="rounded-full w-16 h-16"
                    onClick={(e) => handleResumeClick(item, e)}
                  >
                    <Play className="w-8 h-8 fill-current" />
                  </Button>
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleRemoveItem(item.id, e)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                  {item.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{item.folder || 'Unknown'}</span>
                  {item.year && <span>{item.year}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default ContinueWatching;