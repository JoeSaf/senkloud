// src/components/MobileNavigation.tsx - Separate mobile navigation component
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  User, 
  LogOut, 
  Home, 
  Upload, 
  Settings, 
  Film, 
  Image, 
  Music,
  Folder,
  Clock,
  Star
} from 'lucide-react';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isOpen,
  onClose,
  user,
  onLogout
}) => {
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

  const quickLinks = [
    { to: '/folder/video', icon: Film, label: 'Movies', color: 'text-blue-400' },
    { to: '/folder/image', icon: Image, label: 'Photos', color: 'text-green-400' },
    { to: '/folder/audio', icon: Music, label: 'Music', color: 'text-purple-400' },
  ];

  const recentItems = [
    { to: '/recent', icon: Clock, label: 'Recently Added', color: 'text-orange-400' },
    { to: '/favorites', icon: Star, label: 'Favorites', color: 'text-yellow-400' },
    { to: '/folders', icon: Folder, label: 'All Folders', color: 'text-gray-400' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Mobile Menu */}
      <div className="fixed inset-x-0 top-16 sm:top-20 z-50 lg:hidden">
        <div className="bg-background/98 backdrop-blur-xl border-t border-b border-border/20 shadow-2xl">
          <div className="max-w-md mx-auto p-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* User Profile Section */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl mb-6 border border-primary/20">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center ring-2 ring-primary/30">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-lg">{user?.username}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.is_admin ? '👑 Administrator' : '👤 User'}
                </p>
              </div>
              <button 
                onClick={onLogout}
                className="p-2.5 rounded-xl hover:bg-destructive/20 transition-all duration-200 group"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-muted-foreground group-hover:text-destructive transition-colors" />
              </button>
            </div>

            {/* Main Navigation */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-6 bg-primary rounded-full"></div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Navigation
                </h3>
              </div>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => 
                    `group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 mobile-touch-target ${
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-lg scale-[0.98]' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-[0.98]'
                    }`
                  }
                >
                  <div className={`p-2 rounded-xl transition-colors ${
                    location.pathname === item.to 
                      ? 'bg-primary-foreground/20' 
                      : 'bg-accent/50 group-hover:bg-accent'
                  }`}>
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-base">{item.label}</p>
                    <p className="text-xs opacity-75 mt-0.5">{item.description}</p>
                  </div>
                </NavLink>
              ))}
            </div>

            {/* Quick Access Section */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-6 bg-secondary rounded-full"></div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Quick Access
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {quickLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={onClose}
                    className="group flex flex-col items-center gap-3 p-4 bg-accent/30 hover:bg-accent/60 rounded-2xl transition-all duration-200 mobile-touch-target hover:scale-105"
                  >
                    <div className="p-3 bg-background/50 rounded-xl group-hover:scale-110 transition-transform">
                      <link.icon className={`w-6 h-6 ${link.color} group-hover:scale-110 transition-transform`} />
                    </div>
                    <span className="text-xs font-semibold text-center text-foreground leading-tight">
                      {link.label}
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Recent & Favorites Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-6 bg-accent rounded-full"></div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  More Options
                </h3>
              </div>
              {recentItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className="group flex items-center gap-4 p-3 rounded-xl hover:bg-accent/30 transition-all duration-200 mobile-touch-target"
                >
                  <item.icon className={`w-5 h-5 ${item.color} flex-shrink-0`} />
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {item.label}
                  </span>
                </NavLink>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-8 pt-6 border-t border-border/20">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>© 2024 MediaServer</span>
                <div className="flex items-center gap-3">
                  <button className="hover:text-foreground transition-colors">Help</button>
                  <button className="hover:text-foreground transition-colors">Settings</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileNavigation;