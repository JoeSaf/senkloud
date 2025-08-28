// src/contexts/AuthContext.tsx - Fixed version
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (userData: {
    username: string;
    password: string;
    confirm_password: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if we have stored credentials first
      const storedUsername = localStorage.getItem('username');
      const storedIsAdmin = localStorage.getItem('isAdmin');
      
      if (!storedUsername) {
        // No stored credentials, user is not logged in
        setIsLoading(false);
        return;
      }

      console.log('Checking auth status with server...');
      
      // Try a simple health check first to avoid HTML responses
      const healthResponse = await apiService.healthCheck();
      if (!healthResponse.success) {
        console.log('Server not reachable, keeping cached auth');
        // Server not reachable, but we have credentials - keep user logged in
        setUser({
          id: '1',
          username: storedUsername,
          is_admin: storedIsAdmin === 'true',
        });
        setIsLoading(false);
        return;
      }

      // Server is reachable, try to verify auth with a protected endpoint
      const response = await apiService.getAdminStats();
      if (response.success || (response.data && !response.error)) {
        // Server confirms we're authenticated
        const userData = {
          id: '1',
          username: storedUsername,
          is_admin: storedIsAdmin === 'true',
        };
        setUser(userData);
        console.log('Auth verified - user is authenticated');
      } else {
        // Server says we're not authenticated, try a basic API call
        const filesResponse = await apiService.getFiles();
        if (filesResponse.success || (filesResponse.data && !filesResponse.error)) {
          // Basic API works, user is authenticated but might not be admin
          setUser({
            id: '1',
            username: storedUsername,
            is_admin: false, // Default to non-admin if admin check fails
          });
          console.log('Auth verified - user authenticated (non-admin)');
        } else {
          console.log('Auth check failed - clearing session');
          clearAuthData();
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // On network error with stored credentials, keep user logged in
      const storedUsername = localStorage.getItem('username');
      if (storedUsername) {
        console.log('Network error but have credentials, keeping user logged in');
        setUser({
          id: '1',
          username: storedUsername,
          is_admin: localStorage.getItem('isAdmin') === 'true',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthData = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    setUser(null);
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('Attempting login for user:', username);
      
      const response = await apiService.login(username, password);
      const userPayload = (response.data as any)?.user;
      if (response.success && userPayload) {
        const u: User = {
          id: userPayload.id ?? '1',
          username: userPayload.username,
          is_admin: Boolean(userPayload.is_admin),
        };
        setUser(u);
        
        // Store user data in localStorage for persistence
        localStorage.setItem('username', u.username);
        localStorage.setItem('isAdmin', u.is_admin.toString());
        
        console.log('Login successful');
        return true;
      }
      
      console.log('Login failed - invalid credentials');
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: {
    username: string;
    password: string;
    confirm_password: string;
  }): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await apiService.register(userData.username, userData.password);
      return response.success;
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await apiService.logout();
      clearAuthData();
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local data even if server request fails
      clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};