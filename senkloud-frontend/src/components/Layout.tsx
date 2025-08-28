import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Cloud,
  Upload, 
  Settings, 
  User, 
  LogOut, 
  Search, 
  Menu, 
  X,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SearchModal from './SearchModal';
import MediaPlayer from './MediaPlayer';

interface LayoutProps {
  children: React.ReactNode;
}

interface MediaItem {
  id: string;
  title: string;
  image: string;
  duration?: string;
  year?: string;
  genre?: string;
  type?: string;
  url?: string;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isAuthPage = ['/login', '/register'].includes(location.pathname);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      setScrolled(offset > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K to open search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (!isAuthPage) {
          setIsSearchOpen(true);
        }
      }
      
      // Escape to close modals
      if (event.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        } else if (isPlayerOpen) {
          setIsPlayerOpen(false);
          setSelectedMedia(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isMobileMenuOpen, isPlayerOpen, isAuthPage]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSearchItemSelect = (item: any) => {
    const mediaItem: MediaItem = {
      id: item.id,
      title: item.title,
      image: item.image,
      duration: item.duration,
      year: item.year,
      genre: item.genre,
      type: item.type,
      url: item.url,
    };
    
    setSelectedMedia(mediaItem);
    setIsPlayerOpen(true);
    setIsSearchOpen(false);
  };

  // Navigation items
  const navItems = [
    { 
      to: '/', 
      icon: Home, 
      label: 'Gallery',
      description: 'Browse your media collection'
    },
    { 
      to: '/upload', 
      icon: Upload, 
      label: 'Upload',
      description: 'Add new media files'
    },
    ...(user?.is_admin ? [{
      to: '/admin',
      icon: Settings,
      label: 'Admin',
      description: 'System administration'
    }] : [])
  ];

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-destructive text-destructive-foreground text-center py-2 text-sm font-medium">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            You're currently offline. Some features may not work.
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        !isOnline ? 'top-10' : 'top-0'
      } ${
        scrolled 
          ? 'bg-background/95 backdrop-blur-xl border-b shadow-sm' 
          : 'bg-background/80 backdrop-blur-xl'
      }`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                <Cloud className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">SenKloud</h1>
                <div className="text-xs text-muted-foreground">Personal Media Hub</div>
              </div>
            </div>

            {/* Desktop Search */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search your library... (⌘K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  className="pl-10 bg-card/50 border-border/50 focus:bg-card"
                />
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => 
                    `flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium ${
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-lg' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              {/* Mobile Search Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(true)}
                className="md:hidden min-w-[44px] min-h-[44px]"
              >
                <Search className="w-5 h-5" />
              </Button>

              {/* User Menu - Desktop Only */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card border">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-primary-foreground" />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-foreground">{user?.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {user?.is_admin ? 'Administrator' : 'User'}
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Logout"
                  className="min-w-[44px] min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden min-w-[44px] min-h-[44px]"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-background border-l shadow-xl overflow-y-auto">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                    <Cloud className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground">SenKloud</h2>
                    <p className="text-xs text-muted-foreground">Media Hub</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="min-w-[44px] min-h-[44px]"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* User Info */}
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{user?.username}</div>
                    <div className="text-sm text-muted-foreground">
                      {user?.is_admin ? '👑 Administrator' : '👤 User'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex-1 p-4 sm:p-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Navigation
                  </h3>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) => 
                        `flex items-center gap-3 p-3 rounded-xl transition-all duration-200 min-h-[48px] ${
                          isActive 
                            ? 'bg-primary text-primary-foreground shadow-lg' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`
                      }
                    >
                      <div className={`p-2 rounded-lg ${
                        location.pathname === item.to 
                          ? 'bg-primary-foreground/20' 
                          : 'bg-accent'
                      }`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs opacity-75">{item.description}</div>
                      </div>
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 border-t">
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  className="w-full min-h-[48px]"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
                
                <div className="flex items-center justify-center mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {isOnline ? (
                      <>
                        <Wifi className="w-3 h-3" />
                        <span>Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" />
                        <span>Offline</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`pt-16 pb-safe ${!isOnline ? 'pt-26' : ''}`}>
        {children}
      </main>

      {/* Search Modal */}
      {isSearchOpen && (
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onItemSelect={handleSearchItemSelect}
        />
      )}

      {/* Media Player */}
      {selectedMedia && (
        <MediaPlayer
          isOpen={isPlayerOpen}
          onClose={() => {
            setIsPlayerOpen(false);
            setSelectedMedia(null);
          }}
          media={selectedMedia}
        />
      )}
    </div>
  );
};

export default Layout;