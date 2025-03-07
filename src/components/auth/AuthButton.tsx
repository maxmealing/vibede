'use client';

import React from 'react';
import { useAuthContext } from './AuthProvider';
import { Button } from '../ui/button';

export const AuthButton: React.FC = () => {
  const { isAuthenticated, isLoading, login, logout, user } = useAuthContext();

  return (
    <div className="flex flex-col items-center gap-2">
      {isAuthenticated ? (
        <div className="flex flex-col items-center gap-4">
          {user?.picture && (
            <img 
              src={user.picture} 
              alt={user.name || 'User'} 
              className="w-10 h-10 rounded-full"
            />
          )}
          <div className="text-center">
            <p className="font-medium">{user?.name || 'Authenticated User'}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <Button 
            onClick={logout} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Logging out...' : 'Logout'}
          </Button>
        </div>
      ) : (
        <Button 
          onClick={login} 
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Login with Auth0'}
        </Button>
      )}
    </div>
  );
}; 