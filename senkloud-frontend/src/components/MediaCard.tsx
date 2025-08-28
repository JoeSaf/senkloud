import React, { useState } from 'react';
import { Play, Clock, Calendar, Film, Music, Image as ImageIcon, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MediaCardProps {
  title: string;
  image: string;
  duration?: string;
  year?: string;
  genre?: string;
  type?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

const MediaCard: React.FC<MediaCardProps> = ({
  title,
  image,
  duration,
  year,
  genre,
  type = 'video',
  onClick,
  size = 'md',
  showDetails = true
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sizeClasses = {
    sm: 'aspect-[3/4]',
    md: 'aspect-[3/4]',
    lg: 'aspect-[16/9]'
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'video': return Film;
      case 'audio': return Music;
      case 'image': return ImageIcon;
      default: return FileText;
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'video': return 'bg-blue-500/10 text-blue-500';
      case 'audio': return 'bg-green-500/10 text-green-500';
      case 'image': return 'bg-purple-500/10 text-purple-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const TypeIcon = getTypeIcon();

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  return (
    <Card 
      className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] overflow-hidden border-0 shadow-md hover:shadow-2xl"
      onClick={onClick}
    >
      {/* Image Container */}
      <div className={`relative ${sizeClasses[size]} overflow-hidden bg-muted`}>
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
            <TypeIcon className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}

        {/* Image */}
        {!imageError ? (
          <img
            src={image}
            alt={title}
            className={`w-full h-full object-cover transition-all duration-500 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            } group-hover:scale-110`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <TypeIcon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
          <Button
            size="icon"
            className="w-12 h-12 rounded-full bg-primary/90 hover:bg-primary shadow-lg backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            <Play className="w-5 h-5 text-primary-foreground fill-current" />
          </Button>
        </div>

        {/* Type Badge */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Badge className={`${getTypeColor()} border-0 text-xs`}>
            <TypeIcon className="w-3 h-3 mr-1" />
            {type}
          </Badge>
        </div>

        {/* Duration Badge */}
        {duration && duration !== 'Unknown' && (
          <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
            <Clock className="w-3 h-3 inline mr-1" />
            {duration}
          </div>
        )}
      </div>

      {/* Content */}
      {showDetails && (
        <CardContent className="p-3 space-y-2">
          <h3 
            className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200" 
            title={title}
          >
            {title}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <TypeIcon className="w-3 h-3" />
              <span className="capitalize">{genre || type}</span>
            </div>
            {year && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{year}</span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default MediaCard;