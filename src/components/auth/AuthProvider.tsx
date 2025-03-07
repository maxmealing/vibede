'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { auth0Config } from '../../lib/auth0-config';

// Helper to check if we're running in a Tauri environment
const isTauriApp = () => {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
};

// Log Auth0 configuration at import time
console.log('Auth0 Config (at import):', {
  domain: auth0Config.domain,
  clientId: auth0Config.clientId,
  callbackUrl: auth0Config.callbackUrl
});

// Auth context types
interface UserInfo {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserInfo | undefined;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuthState: () => Promise<void>;
}

// Create auth context with default values
const AuthContext = createContext<AuthContextType>({
  isLoading: false,
  isAuthenticated: false,
  user: undefined,
  error: null,
  login: async () => {},
  logout: async () => {},
  checkAuthState: async () => {},
});

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isProviderReady, setIsProviderReady] = useState(false);
  const {
    isInitialized,
    isLoading,
    isAuthenticated,
    user,
    error,
    initialize,
    login: authLogin,
    logout: authLogout,
    checkAuthState,
  } = useAuth();

  // Initialize Auth0 on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!isInitialized) {
          await initialize(auth0Config);
        }
        setIsProviderReady(true);
      } catch (err) {
        console.error('Failed to initialize Auth0:', err);
      }
    };

    initAuth();
  }, [initialize, isInitialized]);

  // Listen for deep link events (for Auth0 callback handling)
  useEffect(() => {
    if (!isProviderReady) return;
    
    // Only set up deep link listener if we're in a Tauri environment
    if (!isTauriApp()) {
      console.log('Not in Tauri environment, skipping deep link listener');
      return;
    }

    let unsubscribeDeepLink: (() => void) | undefined;

    // Use an immediately invoked async function to set up listener
    (async () => {
      try {
        // Dynamically import Tauri API only when needed and in Tauri context
        const { listen } = await import('@tauri-apps/api/event');
        
        // This is for handling deep links that may come from Auth0 callbacks
        unsubscribeDeepLink = await listen<string>('tauri://protocol-requested', (event) => {
          console.log('Deep link detected:', event.payload);
          // The URL will be in the format: vibede://callback?code=xxx&state=yyy
        
          // Here we could handle the Auth0 callback if needed, but our Rust backend
          // already handles this via the URI scheme handler we registered
        });
      } catch (err) {
        console.error('Error setting up deep link handler:', err);
      }
    })();

    return () => {
      if (unsubscribeDeepLink) unsubscribeDeepLink();
    };
  }, [isProviderReady]);

  // Login function
  const login = async () => {
    if (!isInitialized) {
      console.error('Auth0 is not initialized');
      return;
    }
    
    try {
      await authLogin();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  // Logout function
  const logout = async () => {
    if (!isInitialized) {
      console.error('Auth0 is not initialized');
      return;
    }
    
    try {
      await authLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Context value
  const contextValue: AuthContextType = {
    isLoading,
    isAuthenticated,
    user,
    error,
    login,
    logout,
    checkAuthState,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuthContext = () => useContext(AuthContext); 