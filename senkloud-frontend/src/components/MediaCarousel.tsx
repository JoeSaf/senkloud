import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MediaCard from './MediaCard';

interface MediaItem {
  id: string;
  title: string;
  image: string;
  duration?: string;
  year?: string;
  genre?: string;
}

interface MediaCarouselProps {
  title: string;
  items: MediaItem[];
  onItemClick?: (item: MediaItem) => void;
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({ title, items, onItemClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320; // Width of one card + gap
      const currentScroll = scrollRef.current.scrollLeft;
      const targetScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      scrollRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="mb-8 sm:mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
        
        {/* Navigation Controls - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div 
        ref={scrollRef}
        className="carousel-container"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {items.map((item) => (
          <div key={item.id} className="flex-shrink-0 w-48 sm:w-56 md:w-64" style={{ scrollSnapAlign: 'start' }}>
            <MediaCard
              title={item.title}
              image={item.image}
              duration={item.duration}
              year={item.year}
              genre={item.genre}
              onClick={() => onItemClick?.(item)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaCarousel;