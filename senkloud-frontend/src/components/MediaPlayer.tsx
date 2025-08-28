// src/components/MediaPlayer.tsx - Fixed Auto-Hide Controls & Cursor
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Maximize2,
  Minimize2,
  Settings,
  X,
  List,
  Download,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface MediaPlayerProps {
  isOpen: boolean;
  media: {
    id: string;
    title: string;
    url: string;
    image: string;
    type?: string;
    year?: string;
    duration?: string;
  } | null;
  onClose: () => void;
  episodeList?: Array<{
    id: string;
    title: string;
    url: string;
    image: string;
    type?: string;
  }>;
  currentEpisodeIndex?: number;
  onEpisodeChange?: (index: number) => void;
  recommendedMedia?: Array<{
    id: string;
    title: string;
    image: string;
    url: string;
  }>;
  onRecommendedSelect?: (media: any) => void;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({
  isOpen,
  media,
  onClose,
  episodeList = [],
  currentEpisodeIndex = 0,
  onEpisodeChange,
  recommendedMedia = [],
  onRecommendedSelect
}) => {
  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derived state
  const isVideo = media?.type === 'video' || media?.url?.includes('.mp4') || media?.url?.includes('.webm') || media?.url?.includes('.mov');
  const isAudio = media?.type === 'audio' || media?.url?.includes('.mp3') || media?.url?.includes('.wav') || media?.url?.includes('.ogg');
  const isImage = media?.type === 'image' || media?.url?.includes('.jpg') || media?.url?.includes('.png') || media?.url?.includes('.gif') || media?.url?.includes('.webp');
  
  const nextEpisode = episodeList[currentEpisodeIndex + 1];
  const previousEpisode = episodeList[currentEpisodeIndex - 1];

  // Get current media element
  const getCurrentMediaElement = useCallback(() => {
    return isVideo ? videoRef.current : audioRef.current;
  }, [isVideo]);

  // Mobile device detection
  const isMobileDevice = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
           window.innerWidth <= 768;
  }, []);

  // Handle mouse movement for auto-hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    
    // Only auto-hide if in fullscreen and playing
    if ((isFullscreen || isMobileFullscreen) && isPlaying && !isImage) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isFullscreen, isMobileFullscreen, isPlaying, isImage]);

  // Handle mouse leave - keep controls visible when mouse leaves player area
  const handleMouseLeave = useCallback(() => {
    // Don't auto-hide on mouse leave, only on timeout
    // This prevents controls from disappearing when mouse moves to edges
  }, []);

  // Format time for display
  const formatTime = useCallback((seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Play/Pause toggle
  const togglePlayPause = useCallback(async () => {
    const mediaElement = getCurrentMediaElement();
    if (!mediaElement) return;
    
    try {
      if (isPlaying) {
        await mediaElement.pause();
      } else {
        await mediaElement.play();
      }
      
      // Show controls briefly after play/pause
      setShowControls(true);
      if ((isFullscreen || isMobileFullscreen) && !isPlaying) {
        handleMouseMove(); // Use existing mouse move logic
      }
      
    } catch (error) {
      console.log('Play/Pause failed:', error);
    }
  }, [getCurrentMediaElement, isPlaying, isFullscreen, isMobileFullscreen, handleMouseMove]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const mediaElement = getCurrentMediaElement();
    if (!mediaElement) return;
    
    const newMuted = !isMuted;
    mediaElement.muted = newMuted;
    setIsMuted(newMuted);
    
    // Trigger mouse move to show controls briefly
    handleMouseMove();
  }, [getCurrentMediaElement, isMuted, handleMouseMove]);

  // Adjust volume
  const adjustVolume = useCallback((delta: number) => {
    const newVolume = Math.max(0, Math.min(100, volume + delta));
    setVolume(newVolume);
    
    const mediaElement = getCurrentMediaElement();
    if (mediaElement) {
      mediaElement.volume = newVolume / 100;
    }
    
    // Trigger mouse move to show controls briefly
    handleMouseMove();
  }, [volume, getCurrentMediaElement, handleMouseMove]);

  // Skip time
  const skipTime = useCallback((seconds: number) => {
    const mediaElement = getCurrentMediaElement();
    if (!mediaElement) return;
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    mediaElement.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Trigger mouse move to show controls briefly
    handleMouseMove();
  }, [getCurrentMediaElement, currentTime, duration, handleMouseMove]);

  // Fullscreen handling
  const enterFullscreen = useCallback(async () => {
    const container = playerContainerRef.current;
    if (!container) return;
    
    try {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        await (container as any).webkitRequestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        await (container as any).mozRequestFullScreen();
      } else if ((container as any).msRequestFullscreen) {
        await (container as any).msRequestFullscreen();
      }
      
      // Lock orientation to landscape if available
      if (screen.orientation && (screen.orientation as any).lock) {
        try {
          await (screen.orientation as any).lock('landscape');
        } catch (e) {
          console.log('Orientation lock failed:', e);
        }
      }
    } catch (error) {
      console.log('Fullscreen failed, using fallback:', error);
      // Fallback for mobile
      setIsFullscreen(true);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      } else {
        // Fallback
        setIsFullscreen(false);
        
        // Unlock orientation if available
        if (screen.orientation && (screen.orientation as any).unlock) {
          try {
            (screen.orientation as any).unlock();
          } catch (e) {
            console.log('Orientation unlock failed:', e);
          }
        }
      }
    } catch (error) {
      console.log('Exit fullscreen failed:', error);
      setIsFullscreen(false);
    }
  }, []);

  // Mobile fullscreen handling
  const enterMobileFullscreen = useCallback(async () => {
    if (!playerContainerRef.current) return;
    
    const container = playerContainerRef.current;
    
    try {
      console.log('Entering mobile fullscreen mode');
      
      // Lock orientation to landscape if available
      if (screen.orientation && (screen.orientation as any).lock) {
        try {
          await (screen.orientation as any).lock('landscape');
          console.log('Screen orientation locked to landscape');
        } catch (e) {
          console.log('Orientation lock not supported or failed:', e);
        }
      }
      
      setIsMobileFullscreen(true);
      
      // Apply fullscreen styles
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.right = '0';
      container.style.bottom = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.zIndex = '9999';
      container.style.background = '#000';
      
      // Try native fullscreen first
      if ('requestFullscreen' in container) {
        try {
          await container.requestFullscreen();
          setIsNativeFullscreen(true);
          console.log('Native fullscreen activated');
        } catch (e) {
          console.log('Native fullscreen failed, using fallback:', e);
        }
      } else {
        // iOS Safari fallback - try video element fullscreen
        const videoElement = container.querySelector('video');
        if (videoElement && 'webkitRequestFullscreen' in videoElement) {
          try {
            await (videoElement as any).webkitRequestFullscreen();
            setIsNativeFullscreen(true);
            console.log('iOS video fullscreen activated');
          } catch (e) {
            console.log('iOS fullscreen failed:', e);
          }
        }
      }
      
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Hide browser UI on mobile by scrolling
      setTimeout(() => {
        window.scrollTo(0, 1);
      }, 100);
      
    } catch (error) {
      console.error('Mobile fullscreen setup failed:', error);
    }
  }, []);

  const exitMobileFullscreen = useCallback(async () => {
    if (!playerContainerRef.current) return;
    
    const container = playerContainerRef.current;
    
    try {
      console.log('Exiting mobile fullscreen mode');
      
      // Unlock orientation
      if (screen.orientation && (screen.orientation as any).unlock) {
        try {
          (screen.orientation as any).unlock();
          console.log('Screen orientation unlocked');
        } catch (e) {
          console.log('Orientation unlock failed:', e);
        }
      }
      
      // Exit native fullscreen if active
      if (isNativeFullscreen) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsNativeFullscreen(false);
      }
      
      // Reset container styles
      container.style.position = '';
      container.style.top = '';
      container.style.left = '';
      container.style.right = '';
      container.style.bottom = '';
      container.style.width = '';
      container.style.height = '';
      container.style.zIndex = '';
      container.style.background = '';
      
      // Restore body scrolling
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      
      setIsMobileFullscreen(false);
      
    } catch (error) {
      console.error('Exit mobile fullscreen failed:', error);
    }
  }, [isNativeFullscreen]);

  // Unified fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = isFullscreen || isMobileFullscreen;
    
    if (isCurrentlyFullscreen) {
      if (isMobileDevice()) {
        exitMobileFullscreen();
      } else {
        exitFullscreen();
      }
    } else {
      if (isMobileDevice()) {
        enterMobileFullscreen();
      } else {
        enterFullscreen();
      }
    }
    
    setIsFullscreen(!isCurrentlyFullscreen);
  }, [isFullscreen, isMobileFullscreen, isMobileDevice, enterMobileFullscreen, exitMobileFullscreen, enterFullscreen, exitFullscreen]);

  // Episode navigation
  const playNextEpisode = useCallback(() => {
    if (nextEpisode && onEpisodeChange) {
      onEpisodeChange(currentEpisodeIndex + 1);
      setShowEpisodeList(false);
    }
  }, [nextEpisode, onEpisodeChange, currentEpisodeIndex]);

  const playPreviousEpisode = useCallback(() => {
    if (previousEpisode && onEpisodeChange) {
      onEpisodeChange(currentEpisodeIndex - 1);
      setShowEpisodeList(false);
    }
  }, [previousEpisode, onEpisodeChange, currentEpisodeIndex]);

  // Handle close
  const handleClose = useCallback(() => {
    const mediaElement = getCurrentMediaElement();
    if (mediaElement) {
      mediaElement.pause();
      setIsPlaying(false);
    }
    // Clear timeout on close
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    
    // Exit fullscreen if active
    if (isFullscreen || isMobileFullscreen) {
      if (isMobileDevice()) {
        exitMobileFullscreen();
      } else {
        exitFullscreen();
      }
      setIsFullscreen(false);
    }
    
    onClose();
  }, [getCurrentMediaElement, isFullscreen, isMobileFullscreen, isMobileDevice, exitMobileFullscreen, exitFullscreen, onClose]);

  // Media event handlers
  useEffect(() => {
    const mediaElement = getCurrentMediaElement();
    if (!mediaElement || !media?.url) return;

    const handleLoadedData = () => {
      setDuration(mediaElement.duration || 0);
      setIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(mediaElement.currentTime || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (nextEpisode) {
        setTimeout(() => {
          setShowRecommendations(true);
        }, 1000);
      }
    };

    mediaElement.addEventListener('loadeddata', handleLoadedData);
    mediaElement.addEventListener('timeupdate', handleTimeUpdate);
    mediaElement.addEventListener('play', handlePlay);
    mediaElement.addEventListener('pause', handlePause);
    mediaElement.addEventListener('waiting', handleWaiting);
    mediaElement.addEventListener('canplay', handleCanPlay);
    mediaElement.addEventListener('ended', handleEnded);

    // Set media source
    mediaElement.src = media.url;
    mediaElement.volume = volume / 100;
    mediaElement.muted = isMuted;

    return () => {
      mediaElement.removeEventListener('loadeddata', handleLoadedData);
      mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
      mediaElement.removeEventListener('play', handlePlay);
      mediaElement.removeEventListener('pause', handlePause);
      mediaElement.removeEventListener('waiting', handleWaiting);
      mediaElement.removeEventListener('canplay', handleCanPlay);
      mediaElement.removeEventListener('ended', handleEnded);
    };
  }, [media?.url, getCurrentMediaElement, volume, isMuted, nextEpisode]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isInFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      console.log('Fullscreen changed:', isInFullscreen);
      setIsNativeFullscreen(isInFullscreen);
      
      // Update main fullscreen state
      const isInAnyFullscreen = isInFullscreen || isMobileFullscreen;
      setIsFullscreen(isInAnyFullscreen);
      
      // Always show controls when not in fullscreen
      if (!isInAnyFullscreen) {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = null;
        }
      } else {
        // In fullscreen, show controls initially then manage visibility
        setShowControls(true);
        // Only start hiding timer if media is playing
        if (isPlaying) {
          setTimeout(() => handleMouseMove(), 500); // Small delay to prevent conflicts
        }
      }
    };

    // Listen to all fullscreen change events for cross-browser support
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isMobileFullscreen, isPlaying, handleMouseMove]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent default browser behavior for media keys
      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'KeyF':
          event.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          event.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          skipTime(-10);
          break;
        case 'ArrowRight':
          event.preventDefault();
          skipTime(10);
          break;
        case 'ArrowUp':
          event.preventDefault();
          adjustVolume(5);
          break;
        case 'ArrowDown':
          event.preventDefault();
          adjustVolume(-5);
          break;
        case 'KeyN':
          event.preventDefault();
          if (nextEpisode) {
            playNextEpisode();
          }
          break;
        case 'KeyP':
          event.preventDefault();
          if (previousEpisode) {
            playPreviousEpisode();
          }
          break;
        case 'KeyL':
          event.preventDefault();
          setShowEpisodeList(!showEpisodeList);
          break;
        case 'Escape':
          event.preventDefault();
          if (isFullscreen || isMobileFullscreen) {
            toggleFullscreen();
          } else {
            handleClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen, togglePlayPause, toggleFullscreen, toggleMute, skipTime, adjustVolume, 
    isFullscreen, isMobileFullscreen, handleClose, nextEpisode, previousEpisode, 
    playNextEpisode, playPreviousEpisode, showEpisodeList
  ]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (isMobileFullscreen) {
        exitMobileFullscreen();
      }
      // Restore body scrolling
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      
      // Clear any timeouts
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isMobileFullscreen, exitMobileFullscreen]);

  // Handle screen touch for mobile
  const handleScreenTouch = useCallback(() => {
    if (isMobileDevice()) {
      setShowControls(!showControls);
      if (showControls && isPlaying && (isFullscreen || isMobileFullscreen)) {
        handleMouseMove();
      }
    }
  }, [isMobileDevice, showControls, isPlaying, isFullscreen, isMobileFullscreen, handleMouseMove]);

  // Player container classes with mobile fullscreen support
  const getPlayerClasses = () => {
    const baseClasses = "relative bg-black rounded-lg overflow-hidden";
    
    if (isMobileFullscreen) {
      return `${baseClasses} fixed inset-0 z-[9999] !rounded-none`;
    }
    
    if (isFullscreen) {
      return `${baseClasses} w-full h-full`;
    }
    
    return `${baseClasses} w-full aspect-video max-h-[80vh]`;
  };

  // Get cursor style based on controls visibility
  const getCursorStyle = () => {
    if ((isFullscreen || isMobileFullscreen) && !showControls && !isImage) {
      return 'none';
    }
    return 'default';
  };

  if (!isOpen || !media) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 sm:p-4">
      <div className="w-full h-full max-w-7xl mx-auto relative">
        <div 
          ref={playerContainerRef}
          className={getPlayerClasses()}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: getCursorStyle() }}
        >
          {/* Video Player */}
          {isVideo && (
            <video 
              ref={videoRef} 
              className="w-full h-full object-contain"
              poster={media.image !== '/placeholder.svg' ? media.image : undefined}
              preload="metadata"
              playsInline
              controls={false}
              onTouchStart={handleScreenTouch}
              onClick={handleScreenTouch}
              style={{ 
                WebkitPlaysinline: true,
                WebkitTransform: 'translateZ(0)',
                cursor: getCursorStyle()
              } as any}
            />
          )}

          {/* Audio Player */}
          {isAudio && (
            <div className="w-full h-full flex items-center justify-center relative" style={{ cursor: getCursorStyle() }}>
              <audio ref={audioRef} preload="metadata" controls={false} />
              <div 
                className="w-full h-full bg-cover bg-center relative"
                style={{ 
                  backgroundImage: media.image !== '/placeholder.svg' 
                    ? `url(${media.image})` 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
                onTouchStart={handleScreenTouch}
                onClick={handleScreenTouch}
              >
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-6 mx-auto backdrop-blur-sm">
                      {isPlaying ? (
                        <Pause className="w-16 h-16 text-white" />
                      ) : (
                        <Play className="w-16 h-16 text-white ml-2" />
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{media.title}</h2>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image Viewer */}
          {isImage && (
            <div className="w-full h-full flex items-center justify-center relative bg-black">
              <img
                src={media.url}
                alt={media.title}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                  cursor: 'grab'
                }}
                draggable={false}
              />
              
              {/* Image Controls */}
              <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/70 rounded-lg p-2 transition-all duration-300 ${
                showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}>
                <button
                  onClick={() => setImageZoom(Math.max(0.25, imageZoom - 0.25))}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
                >
                  <ZoomOut className="w-4 h-4 text-white" />
                </button>
                <span className="text-white text-sm px-2">{Math.round(imageZoom * 100)}%</span>
                <button
                  onClick={() => setImageZoom(Math.min(4, imageZoom + 0.25))}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
                >
                  <ZoomIn className="w-4 h-4 text-white" />
                </button>
                <div className="w-px h-6 bg-white/20 mx-1" />
                <button
                  onClick={() => setImageRotation((imageRotation - 90) % 360)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => setImageRotation((imageRotation + 90) % 360)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
                >
                  <RotateCw className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Loading/Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
              </div>
            </div>
          )}

          {/* Top Controls Bar */}
          <div 
            className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent transition-all duration-300 z-20 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
            style={{ pointerEvents: showControls ? 'auto' : 'none' }}
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
                <div className="text-white">
                  <h3 className="font-semibold">{media.title}</h3>
                  {episodeList.length > 1 && (
                    <p className="text-sm text-white/70">
                      Episode {currentEpisodeIndex + 1} of {episodeList.length}
                      {nextEpisode && ` • Next: ${nextEpisode.title}`}
                    </p>
                  )}
                  {media.year && <p className="text-sm text-white/70">{media.year}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {episodeList.length > 1 && (
                  <button
                    onClick={() => setShowEpisodeList(!showEpisodeList)}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                    title="Episode List (L)"
                  >
                    <List className="w-5 h-5 text-white" />
                  </button>
                )}
                {media.url && (
                  <a
                    href={media.url}
                    download
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                    title="Download"
                  >
                    <Download className="w-5 h-5 text-white" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Controls Overlay */}
          {!isImage && (
            <div 
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-all duration-300 ${
                showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
              style={{ pointerEvents: showControls ? 'auto' : 'none' }}
            >
              <div className="p-6">
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white text-sm font-mono">{formatTime(currentTime)}</span>
                    <div className="flex-1 relative group">
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={(e) => {
                          const mediaElement = getCurrentMediaElement();
                          if (mediaElement) {
                            const newTime = parseFloat(e.target.value);
                            mediaElement.currentTime = newTime;
                            setCurrentTime(newTime);
                          }
                        }}
                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.3) ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.3) 100%)`
                        }}
                      />
                    </div>
                    <span className="text-white text-sm font-mono">{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Main Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Previous Episode */}
                    {previousEpisode && (
                      <button
                        onClick={playPreviousEpisode}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                        title="Previous Episode (P)"
                      >
                        <SkipBack className="w-5 h-5 text-white" />
                      </button>
                    )}

                    {/* Skip Backward */}
                    <button
                      onClick={() => skipTime(-10)}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                      title="Skip Back 10s (←)"
                    >
                      <SkipBack className="w-5 h-5 text-white" />
                    </button>

                    {/* Play/Pause */}
                    <button
                      onClick={togglePlayPause}
                      className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                      title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white ml-1" />
                      )}
                    </button>

                    {/* Skip Forward */}
                    <button
                      onClick={() => skipTime(10)}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                      title="Skip Forward 10s (→)"
                    >
                      <SkipForward className="w-5 h-5 text-white" />
                    </button>

                    {/* Next Episode */}
                    {nextEpisode && (
                      <button
                        onClick={playNextEpisode}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                        title="Next Episode (N)"
                      >
                        <SkipForward className="w-5 h-5 text-white" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Volume Control */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleMute}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                        title={isMuted ? "Unmute (M)" : "Mute (M)"}
                      >
                        {isMuted ? (
                          <VolumeX className="w-5 h-5 text-white" />
                        ) : (
                          <Volume2 className="w-5 h-5 text-white" />
                        )}
                      </button>
                      <div className="w-20 relative group">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => {
                            const newVolume = parseInt(e.target.value);
                            setVolume(newVolume);
                            const mediaElement = getCurrentMediaElement();
                            if (mediaElement) {
                              mediaElement.volume = newVolume / 100;
                            }
                            if (newVolume > 0 && isMuted) {
                              setIsMuted(false);
                              mediaElement!.muted = false;
                            }
                          }}
                          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${isMuted ? 0 : volume}%, rgba(255,255,255,0.3) ${isMuted ? 0 : volume}%, rgba(255,255,255,0.3) 100%)`
                          }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                    >
                      <Settings className="w-5 h-5 text-white" />
                    </button>

                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                      title={isFullscreen || isMobileFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
                    >
                      {isFullscreen || isMobileFullscreen ? (
                        <Minimize2 className="w-5 h-5 text-white" />
                      ) : (
                        <Maximize2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Center Play/Pause Overlay - Only show when paused and controls are hidden */}
          {!isImage && !isPlaying && !showControls && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                onClick={togglePlayPause}
                className="p-4 rounded-full bg-black/50 backdrop-blur-sm transition-all transform hover:scale-110 pointer-events-auto opacity-100"
              >
                <Play className="w-8 h-8 text-white ml-1" />
              </button>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="absolute top-16 right-4 bg-black/90 backdrop-blur-sm rounded-lg p-4 text-white min-w-[200px] z-30">
              <h4 className="font-semibold mb-3">Playback Settings</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-white/70 block mb-1">Playback Speed</label>
                  <select
                    value={playbackRate}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value);
                      setPlaybackRate(rate);
                      const mediaElement = getCurrentMediaElement();
                      if (mediaElement) {
                        mediaElement.playbackRate = rate;
                      }
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-sm"
                  >
                    <option value={0.25}>0.25x</option>
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>Normal</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Episode List */}
          {showEpisodeList && episodeList.length > 1 && (
            <div className="absolute inset-y-0 right-0 w-80 bg-black/90 backdrop-blur-sm overflow-y-auto z-30">
              <div className="p-4 border-b border-white/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">Episodes</h3>
                  <button
                    onClick={() => setShowEpisodeList(false)}
                    className="p-1 rounded-full hover:bg-white/10"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="p-2">
                {episodeList.map((episode, index) => (
                  <button
                    key={episode.id}
                    onClick={() => {
                      onEpisodeChange?.(index);
                      setShowEpisodeList(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg mb-2 transition-all ${
                      index === currentEpisodeIndex
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={episode.image}
                        alt={episode.title}
                        className="w-16 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{episode.title}</p>
                        <p className="text-xs text-white/50">Episode {index + 1}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations Overlay */}
          {showRecommendations && recommendedMedia.length > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">You might also like</h3>
                  <button
                    onClick={() => setShowRecommendations(false)}
                    className="p-1 rounded-full hover:bg-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {recommendedMedia.slice(0, 6).map((item, index) => (
                    <div
                      key={index}
                      className="cursor-pointer group"
                      onClick={() => {
                        setShowRecommendations(false);
                        onRecommendedSelect?.(item);
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full aspect-[3/4] object-cover rounded-lg group-hover:scale-105 transition-transform"
                      />
                      <h4 className="text-sm font-medium mt-2 line-clamp-2">{item.title}</h4>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Click to show/hide controls overlay */}
          <div 
            className="absolute inset-0"
            onClick={() => setShowControls(!showControls)}
            style={{ 
              pointerEvents: showControls ? 'none' : 'auto',
              cursor: getCursorStyle()
            }}
          />
        </div>

        {/* Close button for non-fullscreen mode */}
        {!isFullscreen && !isMobileFullscreen && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-all z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MediaPlayer;