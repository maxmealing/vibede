'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';

// This component is needed because AuthProvider uses client-side hooks
// and needs to be wrapped in 'use client' directive
export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
} 