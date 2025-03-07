'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';

// Helper to check if we're running in a Tauri environment
const isTauriApp = () => {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
};

export default function AuthCallback() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const [codeVerifier, setCodeVerifier] = useState('');
  const [copied, setCopied] = useState(false);
  const [showManualOption, setShowManualOption] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  const addDebugInfo = (info: string) => {
    console.log(info);
    setDebugInfo(prev => [...prev, info]);
  };
  
  // Function to generate a random code verifier for PKCE
  const generateCodeVerifier = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const length = 64; // Standard length for PKCE code verifier
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  };
  
  // Generate a code verifier on component mount
  useEffect(() => {
    setCodeVerifier(generateCodeVerifier());
  }, []);
  
  // Function to copy auth parameters to clipboard
  const copyAuthData = () => {
    const authData = JSON.stringify({
      code,
      state,
      codeVerifier
    }, null, 2);
    
    navigator.clipboard.writeText(authData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

    // Also store the PKCE parameters on the Tauri side for convenience
    if (isTauriApp()) {
      const storeTestParams = async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('set_test_pkce_params', { 
            state: state || '', 
            code_verifier: codeVerifier 
          });
          addDebugInfo("PKCE parameters stored on Tauri side");
        } catch (e) {
          addDebugInfo(`Failed to store PKCE parameters: ${e}`);
        }
      };
      storeTestParams();
    }
  };

  // Attempt automatic redirect
  useEffect(() => {
    if (code && state) {
      try {
        // Try the deep link first
        const redirectUrl = `vibede://callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
        addDebugInfo(`Attempting automatic redirect to: ${redirectUrl}`);
        
        // Set a timeout to show manual options if the redirect doesn't work
        const timer = setTimeout(() => {
          addDebugInfo('Automatic redirect timed out, showing manual option');
          setShowManualOption(true);
        }, 3000);
        
        // Attempt the redirect
        window.location.href = redirectUrl;
        
        return () => clearTimeout(timer);
      } catch (error) {
        addDebugInfo(`Error during redirect: ${error}`);
        setShowManualOption(true);
      }
    } else {
      addDebugInfo('Missing required auth parameters');
      setShowManualOption(true);
    }
  }, [code, state]);

  // Add function to check current PKCE params stored in Tauri
  const checkStoredPkceParams = async () => {
    if (isTauriApp()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const [storedState, storedCodeVerifier] = await invoke('get_test_pkce_params');
        
        addDebugInfo(`Stored state: ${storedState}`);
        addDebugInfo(`Stored code verifier: ${storedCodeVerifier.substr(0, 10)}... (${storedCodeVerifier.length} chars)`);
        
        // Check if they match current values
        if (state) {
          addDebugInfo(`State match: ${state === storedState}`);
        }
        if (codeVerifier) {
          addDebugInfo(`CodeVerifier match: ${codeVerifier === storedCodeVerifier}`);
        }
      } catch (e) {
        addDebugInfo(`Failed to check PKCE params: ${e}`);
      }
    } else {
      addDebugInfo("Cannot check PKCE params - not in Tauri app");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication Callback</CardTitle>
          <CardDescription>
            {showManualOption 
              ? "Please copy the authentication data below to complete the login process." 
              : "Redirecting you back to the application..."}
          </CardDescription>
        </CardHeader>
        
        {showManualOption && code && state && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Authentication Data</h3>
              <p className="text-xs text-gray-500">
                Copy this data and paste it in the Manual Authentication form in the app.
              </p>
              <div className="bg-gray-100 p-3 rounded-md overflow-x-auto">
                <pre className="text-xs">
                  {JSON.stringify({ code, state, codeVerifier }, null, 2)}
                </pre>
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={copyAuthData} 
                  variant="default" 
                  className="w-full"
                >
                  {copied ? 'Copied!' : 'Copy Authentication Data'}
                </Button>
                <Button onClick={checkStoredPkceParams} variant="outline" className="flex-none">
                  Check PKCE
                </Button>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="text-sm font-medium text-blue-800">Instructions:</h4>
              <ol className="text-xs text-blue-700 list-decimal pl-4 mt-1 space-y-1">
                <li>Copy the authentication data above</li>
                <li>Return to the Vibede application</li>
                <li>Click on "Manual Auth" button</li>
                <li>Paste the data in the JSON input field</li>
                <li>Click "Authenticate" to complete the login</li>
              </ol>
            </div>
          </CardContent>
        )}
        
        {(!code || !state) && (
          <CardContent>
            <div className="bg-amber-100 text-amber-800 p-3 rounded-md">
              Error: Missing required authentication parameters.
            </div>
          </CardContent>
        )}
        
        <CardFooter className="flex justify-center">
          <p className="text-xs text-gray-500">
            If you're stuck on this page, please restart the application and try again.
          </p>
        </CardFooter>
      </Card>
      
      {/* Debug information section */}
      <div className="mt-8 p-4 bg-gray-100 rounded-md w-full max-w-2xl">
        <h2 className="text-lg font-semibold mb-2">Debug Information</h2>
        <pre className="text-xs overflow-auto max-h-60 bg-gray-800 text-gray-200 p-3 rounded">
          {debugInfo.map((info, index) => (
            <div key={index}>{`[${new Date().toISOString()}] ${info}`}</div>
          ))}
        </pre>
      </div>
    </div>
  );
} 