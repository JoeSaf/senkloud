// src/pages/PlayerPage.tsx - Enhanced with Episode Navigation and True Fullscreen
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  SkipBack, 
  SkipForward,
  Settings,
  Rewind,
  FastForward,
  ArrowLeft,
  List,
  Clock
} from 'lucide-react';

interface Episode {
  filename: string;
  relative_path: string;
  title: string;
  season?: number;
  episode?: number;
  series_name?: string;
  stream_url: string;
  is_current?: boolean;
}

const PlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get media data from URL params
  const mediaUrl = searchParams.get('url');
  const mediaTitle = searchParams.get('title') || 'Unknown Title';
  const mediaType = searchParams.get('type') || 'video';
  const mediaPoster = searchParams.get('poster');
  
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  
  // Episode navigation state
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [previousEpisode, setPreviousEpisode] = useState<Episode | null>(null);
  const [episodeList, setEpisodeList] = useState<Episode[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(-1);

  // Get current media element
  const getCurrentMediaElement = useCallback(() => {
    return mediaType === 'video' ? videoRef.current : audioRef.current;
  }, [mediaType]);

  // Fetch episode navigation data
  const fetchEpisodeData = useCallback(async () => {
    if (!mediaUrl || mediaType !== 'video') return;
    
    try {
      const filename = mediaUrl.split('/stream/')[1];
      if (!filename) return;

      // Fetch next episode
      const nextResponse = await fetch(`/api/episode/next/${filename}`);
      const nextData = await nextResponse.json();
      
      // Fetch previous episode
      const prevResponse = await fetch(`/api/episode/previous/${filename}`);
      const prevData = await prevResponse.json();
      
      // Fetch all episodes in series
      const seriesResponse = await fetch(`/api/series/${filename}`);
      const seriesData = await seriesResponse.json();

      setNextEpisode(nextData.success ? nextData.next_episode : null);
      setPreviousEpisode(prevData.success ? prevData.previous_episode : null);
      
      if (seriesData.success) {
        setEpisodeList(seriesData.episodes);
        setCurrentEpisodeIndex(seriesData.episodes.findIndex((ep: Episode) => ep.is_current));
      }
    } catch (error) {
      console.error('Error fetching episode data:', error);
    }
  }, [mediaUrl, mediaType]);

  // Enhanced mobile fullscreen with true device fullscreen
  const enterTrueFullscreen = useCallback(async () => {
    try {
      // Multiple approaches for true fullscreen on mobile
      
      // 1. Lock orientation first
      if (screen.orientation && (screen.orientation as any).lock) {
        try {
          await (screen.orientation as any).lock('landscape');
          console.log('Orientation locked to landscape');
        } catch (e) {
          console.log('Orientation lock failed:', e);
        }
      }
      
      // 2. Request fullscreen on document for maximum compatibility
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        console.log('Document fullscreen requested');
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        // Safari iOS
        await (document.documentElement as any).webkitRequestFullscreen();
        console.log('Webkit fullscreen requested');
      } else if ((document.documentElement as any).mozRequestFullScreen) {
        // Firefox
        await (document.documentElement as any).mozRequestFullScreen();
        console.log('Moz fullscreen requested');
      }
      
      // 3. For iOS Safari - also try video element fullscreen
      if (videoRef.current && 'webkitEnterFullscreen' in videoRef.current) {
        try {
          (videoRef.current as any).webkitEnterFullscreen();
          console.log('Video webkit fullscreen entered');
        } catch (e) {
          console.log('Video fullscreen failed:', e);
        }
      }
      
      // 4. Hide browser UI aggressively
      window.scrollTo(0, 1);
      setTimeout(() => window.scrollTo(0, 1), 100);
      setTimeout(() => window.scrollTo(0, 1), 500);
      
      // 5. Prevent scrolling and set viewport
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // 6. Set meta viewport for maximum fullscreen
      let viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, minimal-ui, viewport-fit=cover');
      }
      
    } catch (error) {
      console.error('True fullscreen failed:', error);
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      // Unlock orientation
      if (screen.orientation && (screen.orientation as any).unlock) {
        try {
          (screen.orientation as any).unlock();
        } catch (e) {
          console.log('Orientation unlock failed:', e);
        }
      }
      
      // Exit document fullscreen
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      }
      
      // Restore body styles
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      
      // Restore viewport
      let viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
      
    } catch (error) {
      console.error('Exit fullscreen failed:', error);
    }
  }, []);

  // Format time display
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

  // Handle controls auto-hide
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Media controls
  const togglePlayPause = useCallback(async () => {
    const mediaElement = getCurrentMediaElement();
    if (!mediaElement) return;
    
    try {
      if (isPlaying) {
        await mediaElement.pause();
      } else {
        await mediaElement.play();
      }
      handleUserActivity();
    } catch (error) {
      console.error('Play/Pause failed:', error);
    }
  }, [getCurrentMediaElement, isPlaying, handleUserActivity]);

  const skipTime = useCallback((seconds: number) => {
    const mediaElement = getCurrentMediaElement();
    if (!mediaElement || duration === 0) return;
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    mediaElement.currentTime = newTime;
    setCurrentTime(newTime);
  }, [getCurrentMediaElement, duration, currentTime]);

  // Episode navigation functions
  const playNextEpisode = useCallback(() => {
    if (nextEpisode) {
      const params = new URLSearchParams({
        url: nextEpisode.stream_url,
        title: nextEpisode.title,
        type: 'video',
        poster: mediaPoster || ''
      });
      
      // Update URL without navigation to avoid page reload
      setSearchParams(params);
      setShowNextEpisode(false);
    }
  }, [nextEpisode, mediaPoster, setSearchParams]);

  const playPreviousEpisode = useCallback(() => {
    if (previousEpisode) {
      const params = new URLSearchParams({
        url: previousEpisode.stream_url,
        title: previousEpisode.title,
        type: 'video',
        poster: mediaPoster || ''
      });
      
      setSearchParams(params);
    }
  }, [previousEpisode, mediaPoster, setSearchParams]);

  const playEpisodeFromList = useCallback((episode: Episode) => {
    const params = new URLSearchParams({
      url: episode.stream_url,
      title: episode.title,
      type: 'video',
      poster: mediaPoster || ''
    });
    
    setSearchParams(params);
    setShowEpisodeList(false);
  }, [mediaPoster, setSearchParams]);

  // Handle back navigation
  const handleBack = useCallback(async () => {
    await exitFullscreen();
    navigate(-1);
  }, [navigate, exitFullscreen]);

  // Handle video ended - auto-play next episode
  const handleVideoEnded = useCallback(() => {
    if (autoplayNext && nextEpisode) {
      setShowNextEpisode(true);
      // Auto-play after 5 seconds
      setTimeout(() => {
        if (nextEpisode) {
          playNextEpisode();
        }
      }, 5000);
    }
  }, [autoplayNext, nextEpisode, playNextEpisode]);

  // Initialize true fullscreen on mount
  useEffect(() => {
    enterTrueFullscreen();
    
    // Cleanup function
    return () => {
      exitFullscreen();
    };
  }, [enterTrueFullscreen, exitFullscreen]);

  // Fetch episode data when URL changes
  useEffect(() => {
    fetchEpisodeData();
  }, [fetchEpisodeData]);

  // Handle orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      const orientation = screen.orientation?.angle || (window as any).orientation || 0;
      setIsLandscape(Math.abs(orientation) === 90);
      
      // Re-trigger fullscreen after orientation change
      setTimeout(() => {
        enterTrueFullscreen();
      }, 500);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    // Initial check
    handleOrientationChange();
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [enterTrueFullscreen]);

  // Media event handlers
  useEffect(() => {
    const mediaElement = getCurrentMediaElement();
    if (!mediaElement || !mediaUrl) return;

    const handleLoadedMetadata = () => {
      setDuration(mediaElement.duration || 0);
      setIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(mediaElement.currentTime || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      handleUserActivity();
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleEnded = () => handleVideoEnded();

    const handleError = (e: Event) => {
      console.error('Media error:', e);
      setIsBuffering(false);
      setIsPlaying(false);
    };

    // Set media source
    mediaElement.src = mediaUrl;
    mediaElement.load();

    // Add event listeners
    mediaElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    mediaElement.addEventListener('timeupdate', handleTimeUpdate);
    mediaElement.addEventListener('play', handlePlay);
    mediaElement.addEventListener('pause', handlePause);
    mediaElement.addEventListener('waiting', handleWaiting);
    mediaElement.addEventListener('canplay', handleCanPlay);
    mediaElement.addEventListener('ended', handleEnded);
    mediaElement.addEventListener('error', handleError);

    return () => {
      if (mediaElement) {
        mediaElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
        mediaElement.removeEventListener('play', handlePlay);
        mediaElement.removeEventListener('pause', handlePause);
        mediaElement.removeEventListener('waiting', handleWaiting);
        mediaElement.removeEventListener('canplay', handleCanPlay);
        mediaElement.removeEventListener('ended', handleEnded);
        mediaElement.removeEventListener('error', handleError);
      }
    };
  }, [getCurrentMediaElement, mediaUrl, handleUserActivity, handleVideoEnded]);

  // Set volume and playback rate
  useEffect(() => {
    const mediaElement = getCurrentMediaElement();
    if (mediaElement) {
      mediaElement.volume = isMuted ? 0 : volume / 100;
      mediaElement.playbackRate = playbackRate;
    }
  }, [getCurrentMediaElement, volume, isMuted, playbackRate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (event.shiftKey && previousEpisode) {
            playPreviousEpisode();
          } else {
            skipTime(-10);
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (event.shiftKey && nextEpisode) {
            playNextEpisode();
          } else {
            skipTime(10);
          }
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
          handleBack();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, skipTime, nextEpisode, previousEpisode, playNextEpisode, playPreviousEpisode, showEpisodeList, handleBack]);

  // Handle screen touches to show/hide controls
  const handleScreenTouch = useCallback(() => {
    if (showEpisodeList || showSettings) {
      setShowEpisodeList(false);
      setShowSettings(false);
      return;
    }
    
    setShowControls(!showControls);
    if (!showControls) {
      handleUserActivity();
    }
  }, [showControls, handleUserActivity, showEpisodeList, showSettings]);

  if (!mediaUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-white text-center">
          <p className="text-xl mb-4">No media specified</p>
          <button
            onClick={handleBack}
            className="px-6 py-3 bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50" style={{ height: '100vh', width: '100vw' }}>
      {/* Video Player */}
      {mediaType === 'video' && (
        <video 
          ref={videoRef} 
          className="w-full h-full object-contain"
          poster={mediaPoster || undefined}
          preload="metadata"
          playsInline
          controls={false}
          onTouchStart={handleScreenTouch}
          onClick={handleScreenTouch}
          style={{ 
            WebkitPlaysinline: true,
            WebkitTransform: 'translateZ(0)',
            width: '100vw',
            height: '100vh'
          } as any}
        />
      )}

      {/* Audio Player */}
      {mediaType === 'audio' && (
        <div className="w-full h-full flex items-center justify-center relative">
          <audio ref={audioRef} preload="metadata" controls={false} />
          <div 
            className="w-full h-full bg-cover bg-center relative"
            style={{ 
              backgroundImage: mediaPoster 
                ? `url(${mediaPoster})` 
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
                <h2 className="text-2xl font-bold text-white mb-2">{mediaTitle}</h2>
              </div>
            </div>
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
      >
        <div className="flex items-center justify-between p-4 safe-area-inset-top">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div className="text-white">
              <h3 className="font-semibold text-lg">{mediaTitle}</h3>
              {episodeList.length > 1 && (
                <p className="text-sm text-white/70">
                  Episode {currentEpisodeIndex + 1} of {episodeList.length}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {episodeList.length > 1 && (
              <button
                onClick={() => setShowEpisodeList(!showEpisodeList)}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
              >
                <List className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent transition-all duration-300 z-20 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {/* Progress Bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-sm text-white mb-2">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div 
            className="relative h-2 bg-white/30 rounded-full cursor-pointer"
            onClick={(e) => {
              const mediaElement = getCurrentMediaElement();
              if (mediaElement && duration) {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                const newTime = percent * duration;
                mediaElement.currentTime = newTime;
                setCurrentTime(newTime);
              }
            }}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-red-600 rounded-full"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between px-4 pb-6 safe-area-inset-bottom">
          <div className="flex items-center gap-3">
            {previousEpisode && (
              <button
                onClick={playPreviousEpisode}
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                title="Previous Episode"
              >
                <SkipBack className="w-6 h-6 text-white" />
              </button>
            )}
            
            <button
              onClick={() => skipTime(-10)}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
            >
              <Rewind className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white" />
              ) : (
                <Play className="w-8 h-8 text-white ml-1" />
              )}
            </button>

            <button
              onClick={() => skipTime(10)}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
            >
              <FastForward className="w-6 h-6 text-white" />
            </button>

            {nextEpisode && (
              <button
                onClick={playNextEpisode}
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
                title="Next Episode"
              >
                <SkipForward className="w-6 h-6 text-white" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const mediaElement = getCurrentMediaElement();
                if (mediaElement) {
                  const newMuted = !isMuted;
                  mediaElement.muted = newMuted;
                  setIsMuted(newMuted);
                }
              }}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
            >
              {isMuted ? (
                <VolumeX className="w-6 h-6 text-white" />
              ) : (
                <Volume2 className="w-6 h-6 text-white" />
              )}
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
            >
              <Settings className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Next Episode Overlay */}
      {showNextEpisode && nextEpisode && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full text-center">
            <h3 className="text-lg font-semibold mb-2">Next Episode</h3>
            <p className="text-gray-600 mb-4">{nextEpisode.title}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNextEpisode(false)}
                className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={playNextEpisode}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Play Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Episode List Overlay */}
      {showEpisodeList && episodeList.length > 0 && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-end z-30">
          <div className="bg-white h-full w-80 max-w-full overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Episodes</h3>
                <button
                  onClick={() => setShowEpisodeList(false)}
                  className="p-1 rounded-full hover:bg-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-2">
              {episodeList.map((episode, index) => (
                <button
                  key={episode.relative_path}
                  onClick={() => playEpisodeFromList(episode)}
                  className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                    episode.is_current ? 'bg-red-100 border border-red-300' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">
                    {episode.season && episode.episode ? 
                      `S${episode.season}E${episode.episode.toString().padStart(2, '0')}` :
                      `Episode ${index + 1}`
                    }
                  </div>
                  <div className="text-sm text-gray-600 truncate">{episode.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute bottom-24 right-4 bg-black/90 backdrop-blur-sm rounded-lg p-4 min-w-64 z-30">
          <h4 className="text-white font-semibold mb-4">Settings</h4>
          <div className="space-y-4">
            <div>
              <label className="text-white/70 text-sm block mb-2">Playback Speed</label>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                className="w-full bg-white/20 text-white rounded p-3 text-sm"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>Normal</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>
            <div>
              <label className="text-white/70 text-sm block mb-2">Volume</label>
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
                    if (newVolume > 0) {
                      setIsMuted(false);
                      mediaElement.muted = false;
                    }
                  }
                }}
                className="w-full h-2 bg-white/30 rounded-full appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-white/70 text-sm">Autoplay Next Episode</label>
              <button
                onClick={() => setAutoplayNext(!autoplayNext)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  autoplayNext ? 'bg-red-600' : 'bg-white/30'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  autoplayNext ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center Play Button Overlay */}
      {!isPlaying && !showControls && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="p-6 rounded-full bg-black/50 backdrop-blur-sm">
            <Play className="w-12 h-12 text-white ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerPage;