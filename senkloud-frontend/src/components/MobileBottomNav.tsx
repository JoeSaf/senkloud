// src/components/MobileBottomNav.tsx - Enhanced bottom navigation for mobile
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Upload, 
  Search, 
  Settings, 
  User,
  Film,
  Plus
} from 'lucide-react';

interface MobileBottomNavProps {
  user: any;
  onSearchOpen: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ user, onSearchOpen }) => {
  const location = useLocation();

  const navItems = [
    {
      to: '/',
      icon: Home,
      label: 'Home',
      color: 'text-blue-500'
    },
    {
      to: '/folder/video',
      icon: Film,
      label: 'Movies',
      color: 'text-purple-500'
    },
    {
      action: 'search',
      icon: Search,
      label: 'Search',
      color: 'text-green-500'
    },
    {
      to: '/upload',
      icon: Plus,
      label: 'Upload',
      color: 'text-orange-500'
    },
    {
      to: user?.is_admin ? '/admin' : '/profile',
      icon: user?.is_admin ? Settings : User,
      label: user?.is_admin ? 'Admin' : 'Profile',
      color: 'text-red-500'
    }
  ];

  const handleItemClick = (item: any) => {
    if (item.action === 'search') {
      onSearchOpen();
    }
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Safe area for devices with home indicator */}
        <div className="bg-background/95 backdrop-blur-xl border-t border-border/20 shadow-2xl">
          <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
            {navItems.map((item, index) => {
              const isActive = item.to && location.pathname === item.to;
              const isSearchActive = item.action === 'search' && false; // You can track search state if needed
              
              if (item.to) {
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`group flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 min-w-[60px] mobile-touch-target ${
                      isActive 
                        ? 'bg-primary/10 scale-110' 
                        : 'hover:bg-accent/30 hover:scale-105'
                    }`}
                  >
                    <div className={`relative p-2 rounded-xl transition-all duration-300 ${
                      isActive 
                        ? 'bg-primary shadow-lg shadow-primary/25' 
                        : 'bg-accent/50 group-hover:bg-accent'
                    }`}>
                      <item.icon className={`w-5 h-5 transition-colors ${
                        isActive 
                          ? 'text-primary-foreground' 
                          : `${item.color} group-hover:text-foreground`
                      }`} />
                      
                      {/* Active indicator dot */}
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse">
                          <div className="w-full h-full bg-primary-foreground/30 rounded-full animate-ping"></div>
                        </div>
                      )}
                    </div>
                    
                    <span className={`text-xs font-medium mt-1 transition-colors ${
                      isActive 
                        ? 'text-primary' 
                        : 'text-muted-foreground group-hover:text-foreground'
                    }`}>
                      {item.label}
                    </span>
                  </NavLink>
                );
              } else {
                return (
                  <button
                    key={index}
                    onClick={() => handleItemClick(item)}
                    className={`group flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 min-w-[60px] mobile-touch-target ${
                      isSearchActive 
                        ? 'bg-primary/10 scale-110' 
                        : 'hover:bg-accent/30 hover:scale-105'
                    }`}
                  >
                    <div className={`relative p-2 rounded-xl transition-all duration-300 ${
                      isSearchActive 
                        ? 'bg-primary shadow-lg shadow-primary/25' 
                        : 'bg-accent/50 group-hover:bg-accent'
                    }`}>
                      <item.icon className={`w-5 h-5 transition-colors ${
                        isSearchActive 
                          ? 'text-primary-foreground' 
                          : `${item.color} group-hover:text-foreground`
                      }`} />
                    </div>
                    
                    <span className={`text-xs font-medium mt-1 transition-colors ${
                      isSearchActive 
                        ? 'text-primary' 
                        : 'text-muted-foreground group-hover:text-foreground'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                );
              }
            })}
          </div>
          
          {/* Safe area padding for devices with home indicator */}
          <div className="h-safe-area-inset-bottom bg-background/95"></div>
        </div>
      </div>

      {/* Content padding to account for bottom nav */}
      <div className="md:hidden h-20"></div>
    </>
  );
};

export default MobileBottomNav;