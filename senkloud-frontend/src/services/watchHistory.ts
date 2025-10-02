// src/services/watchHistory.ts
/**
 * Watch History Service
 * Manages video playback progress and watch history using localStorage
 */

export interface WatchHistoryItem {
  id: string;
  title: string;
  url: string;
  image: string;
  type: string;
  currentTime: number;
  duration: number;
  percentage: number;
  lastWatched: string;
  folder?: string;
  year?: string;
}

class WatchHistoryService {
  private readonly STORAGE_KEY = 'senkloud_watch_history';
  private readonly MAX_ITEMS = 50; // Keep last 50 items

  /**
   * Save or update watch progress for a media item
   */
  saveProgress(item: {
    id: string;
    title: string;
    url: string;
    image: string;
    type: string;
    currentTime: number;
    duration: number;
    folder?: string;
    year?: string;
  }): void {
    try {
      const history = this.getHistory();
      const percentage = (item.currentTime / item.duration) * 100;

      // Don't save if video just started (less than 5% watched)
      if (percentage < 5) {
        return;
      }

      // Don't save if video is almost complete (more than 95% watched)
      if (percentage > 95) {
        // Remove from history if finished
        this.removeItem(item.id);
        return;
      }

      const existingIndex = history.findIndex(h => h.id === item.id);
      const historyItem: WatchHistoryItem = {
        ...item,
        percentage,
        lastWatched: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        // Update existing item
        history[existingIndex] = historyItem;
      } else {
        // Add new item at the beginning
        history.unshift(historyItem);
      }

      // Keep only MAX_ITEMS most recent
      const trimmedHistory = history.slice(0, this.MAX_ITEMS);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.error('Error saving watch progress:', error);
    }
  }

  /**
   * Get complete watch history
   */
  getHistory(): WatchHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const history = JSON.parse(stored) as WatchHistoryItem[];
      // Sort by last watched (most recent first)
      return history.sort((a, b) => 
        new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime()
      );
    } catch (error) {
      console.error('Error loading watch history:', error);
      return [];
    }
  }

  /**
   * Get recently watched items (default: 10)
   */
  getRecentlyWatched(limit: number = 10): WatchHistoryItem[] {
    return this.getHistory().slice(0, limit);
  }

  /**
   * Get saved progress for a specific item
   */
  getProgress(itemId: string): WatchHistoryItem | null {
    const history = this.getHistory();
    return history.find(h => h.id === itemId) || null;
  }

  /**
   * Remove an item from history
   */
  removeItem(itemId: string): void {
    try {
      const history = this.getHistory();
      const filtered = history.filter(h => h.id !== itemId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing watch history item:', error);
    }
  }

  /**
   * Clear all watch history
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing watch history:', error);
    }
  }

  /**
   * Update progress periodically (throttled)
   * Call this from video player's timeupdate event
   */
  private lastSaveTime = 0;
  private readonly SAVE_INTERVAL = 5000; // Save every 5 seconds

  throttledSaveProgress(item: {
    id: string;
    title: string;
    url: string;
    image: string;
    type: string;
    currentTime: number;
    duration: number;
    folder?: string;
    year?: string;
  }): void {
    const now = Date.now();
    if (now - this.lastSaveTime >= this.SAVE_INTERVAL) {
      this.saveProgress(item);
      this.lastSaveTime = now;
    }
  }

  /**
   * Get watch statistics
   */
  getStats(): {
    totalWatched: number;
    totalWatchTime: number;
    averageProgress: number;
  } {
    const history = this.getHistory();
    const totalWatched = history.length;
    const totalWatchTime = history.reduce((sum, item) => sum + item.currentTime, 0);
    const averageProgress = history.length > 0
      ? history.reduce((sum, item) => sum + item.percentage, 0) / history.length
      : 0;

    return {
      totalWatched,
      totalWatchTime,
      averageProgress,
    };
  }

  /**
   * Format time for display
   */
  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

export const watchHistoryService = new WatchHistoryService();