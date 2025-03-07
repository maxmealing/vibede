'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { useAuthContext } from './AuthProvider';

export const ManualAuthForm: React.FC = () => {
  const [authData, setAuthData] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { checkAuthState } = useAuthContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Parse the auth data
      let parsedData;
      try {
        parsedData = JSON.parse(authData);
      } catch (err) {
        throw new Error('Invalid JSON format. Please check your input.');
      }

      // Validate the auth data
      if (!parsedData.code || !parsedData.state || !parsedData.codeVerifier) {
        throw new Error('Missing required fields: code, state, and codeVerifier');
      }

      // Import Tauri API
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('Authenticating with:', {
        code: parsedData.code,
        state: parsedData.state,
        codeVerifier: parsedData.codeVerifier
      });

      // Call the manual authenticate command
      await invoke('manual_authenticate', {
        code: parsedData.code,
        state: parsedData.state,
        codeVerifier: parsedData.codeVerifier
      });

      // Update auth state
      await checkAuthState();
      
      setSuccess(true);
      setAuthData('');
    } catch (err) {
      console.error('Manual authentication failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Manual Authentication</CardTitle>
        <CardDescription>
          If automatic authentication isn't working, paste the authentication data from the callback page here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="authData">Authentication Data (JSON)</Label>
            <textarea
              id="authData"
              placeholder='{"code": "...", "state": "...", "codeVerifier": "..."}'
              value={authData}
              onChange={(e) => setAuthData(e.target.value)}
              className="w-full min-h-[100px] p-2 border rounded-md"
              required
            />
            <p className="text-xs text-gray-500">
              Paste the complete JSON data from the callback page. The codeVerifier MUST be the original value used during login.
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
              {error.includes("401 Unauthorized") && (
                <p className="text-xs mt-2">
                  This error typically occurs when the code_verifier doesn't match the original one used during login. 
                  Make sure you're using the exact code verifier generated during the initial login attempt.
                </p>
              )}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">Authentication successful!</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Authenticating...' : 'Authenticate'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-xs text-gray-500">
          This is a fallback method for when deep linking doesn't work properly.
        </p>
      </CardFooter>
    </Card>
  );
}; 