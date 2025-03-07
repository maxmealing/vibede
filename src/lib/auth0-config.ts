/**
 * Auth0 configuration from environment variables
 */

// Helper to check if we're running in a Tauri environment
const isTauriApp = () => {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
};

// Determine the appropriate callback URL based on environment
const getCallbackUrl = () => {
  // Default callback URL from environment variable
  const envCallbackUrl = process.env.NEXT_PUBLIC_AUTH0_CALLBACK_URL || '';
  
  // If we're in a browser environment and not in the Tauri app,
  // use the web callback URL (http://localhost:3000/auth/callback)
  if (typeof window !== 'undefined' && !isTauriApp()) {
    return 'http://localhost:3000/auth/callback';
  }
  
  // In Tauri app or during SSR, use the environment variable or default to the custom protocol
  return envCallbackUrl || 'vibede://callback';
};

export const auth0Config = {
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '',
  clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '',
  callbackUrl: getCallbackUrl(),
  
  // Optional configuration
  audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
  scope: process.env.NEXT_PUBLIC_AUTH0_SCOPE || 'openid profile email'
}; 