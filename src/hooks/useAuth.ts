import { useState, useEffect, useCallback } from 'react';
// Remove static imports of Tauri APIs
// import { invoke } from '@tauri-apps/api/core';
// import { listen } from '@tauri-apps/api/event';

// Helper to check if we're running in a Tauri environment
const isTauriApp = () => {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
};

// Types for Auth0 integration
interface UserInfo {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

interface AuthState {
  authenticated: boolean;
  access_token?: string;
  id_token?: string;
  expires_at?: number;
  user_info?: UserInfo;
}

interface Auth0Config {
  domain: string;
  clientId: string;
  callbackUrl?: string;
  audience?: string;
  scope?: string;
}

// Hook for Auth0 authentication
export function useAuth() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({
    authenticated: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Load the current authentication state
  const checkAuthState = useCallback(async () => {
    try {
      console.log('Checking authentication state...');
      setIsLoading(true);
      
      if (isTauriApp()) {
        console.log('In Tauri environment, invoking get_auth_state');
        // Dynamically import Tauri API only when needed and in Tauri context
        const { invoke } = await import('@tauri-apps/api/core');
        
        const currentState = await invoke('get_auth_state') as AuthState;
        console.log('Received auth state:', JSON.stringify(currentState, null, 2));
        setAuthState(currentState);
      } else {
        // For browser-only environment, we might want to check localStorage or cookies
        console.log('Not in Tauri environment, no auth state to check');
      }
      
      setIsLoading(false);
      console.log('Auth state check complete');
    } catch (err) {
      console.error('Failed to load auth state:', err);
      setError(`Failed to load auth state: ${err}`);
      setIsLoading(false);
    }
  }, []);

  // Initialize Auth0 configuration
  const initialize = useCallback(async (config: Auth0Config) => {
    try {
      console.log('Initializing Auth0...');
      setIsLoading(true);
      setError(null);
      
      console.log('Auth0 config:', JSON.stringify(config, null, 2));
      
      if (isTauriApp()) {
        console.log('In Tauri environment, invoking initialize_auth0');
        // Dynamically import Tauri API only when needed and in Tauri context
        const { invoke } = await import('@tauri-apps/api/core');
        
        console.log('Sending initialize_auth0 command to Tauri backend');
        await invoke('initialize_auth0', {
          domain: config.domain,
          clientId: config.clientId,
          callbackUrl: config.callbackUrl,
          audience: config.audience,
          scope: config.scope,
        });
        console.log('Auth0 initialized successfully in Tauri backend');
        
        setIsInitialized(true);
        setIsLoading(false);
        
        // Immediately load auth state if available
        console.log('Checking initial auth state');
        await checkAuthState();
      } else {
        console.log('Not in Tauri environment, skipping native initialization');
        // For browser-only environment, just mark as initialized
        setIsInitialized(true);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to initialize Auth0:', err);
      setError(`Failed to initialize Auth0: ${err}`);
      setIsLoading(false);
    }
  }, [checkAuthState]);

  // Start the login flow
  const login = useCallback(async () => {
    try {
      console.log('Starting login flow...');
      setIsLoading(true);
      setError(null);
      
      if (!isInitialized) {
        console.error('Auth0 is not initialized. Call initialize() first.');
        throw new Error('Auth0 is not initialized. Call initialize() first.');
      }
      
      if (isTauriApp()) {
        console.log('In Tauri environment, invoking login command');
        // Dynamically import Tauri API only when needed and in Tauri context
        const { invoke } = await import('@tauri-apps/api/core');
        
        console.log('Sending login command to Tauri backend');
        await invoke('login');
        console.log('Login command sent successfully');
        // The actual state update will happen via the event listener
      } else {
        // For browser-only environment, we might redirect to Auth0 login page
        console.log('Not in Tauri environment, cannot perform native login');
        // You could implement a browser-based login flow here if needed
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError(`Login failed: ${err}`);
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Log out the user
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!isInitialized) {
        throw new Error('Auth0 is not initialized. Call initialize() first.');
      }
      
      if (isTauriApp()) {
        // Dynamically import Tauri API only when needed and in Tauri context
        const { invoke } = await import('@tauri-apps/api/core');
        
        await invoke('logout');
        // The actual state update will happen via the event listener
      } else {
        // For browser-only environment, we might clear localStorage or cookies
        console.log('Not in Tauri environment, cannot perform native logout');
        // You could implement a browser-based logout flow here if needed
      }
    } catch (err) {
      setError(`Logout failed: ${err}`);
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Set up event listeners for Auth0 events
  useEffect(() => {
    let unsubscribeLoginComplete: (() => void) | undefined;
    let unsubscribeLoginError: (() => void) | undefined;
    let unsubscribeLogoutComplete: (() => void) | undefined;
    
    // Only set up listeners if we're in a Tauri environment
    if (isTauriApp()) {
      console.log('Setting up Auth0 event listeners in Tauri environment');
      
      // Use an immediately invoked async function to set up listeners
      (async () => {
        try {
          // Dynamically import Tauri API only when needed and in Tauri context
          const { listen } = await import('@tauri-apps/api/event');
          
          console.log('Setting up auth:login-complete listener');
          unsubscribeLoginComplete = await listen<void>('auth:login-complete', () => {
            console.log('Received auth:login-complete event');
            checkAuthState();
          });
      
          console.log('Setting up auth:login-error listener');
          unsubscribeLoginError = await listen<string>('auth:login-error', (event) => {
            console.log('Received auth:login-error event:', event.payload);
            setError(`Authentication error: ${event.payload}`);
            setIsLoading(false);
          });
      
          console.log('Setting up auth:logout-complete listener');
          unsubscribeLogoutComplete = await listen<void>('auth:logout-complete', () => {
            console.log('Received auth:logout-complete event');
            setAuthState({ authenticated: false });
            setIsLoading(false);
          });
          
          console.log('All Auth0 event listeners set up successfully');
        } catch (err) {
          console.error('Error setting up Auth0 event listeners:', err);
        }
      })();
    }

    // Cleanup event listeners on unmount
    return () => {
      console.log('Cleaning up Auth0 event listeners');
      if (unsubscribeLoginComplete) {
        console.log('Unsubscribing from auth:login-complete');
        unsubscribeLoginComplete();
      }
      if (unsubscribeLoginError) {
        console.log('Unsubscribing from auth:login-error');
        unsubscribeLoginError();
      }
      if (unsubscribeLogoutComplete) {
        console.log('Unsubscribing from auth:logout-complete');
        unsubscribeLogoutComplete();
      }
    };
  }, [checkAuthState]);

  return {
    isInitialized,
    isLoading,
    isAuthenticated: authState.authenticated,
    user: authState.user_info,
    error,
    initialize,
    login,
    logout,
    checkAuthState,
  };
} 