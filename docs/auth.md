# Auth0 Integration Documentation

This document outlines how authentication is implemented in the Vibede application using Auth0.

## Overview

Vibede uses Auth0 as the authentication provider with a custom integration that leverages:

- Auth0's Universal Login Page for secure authentication
- Tauri's custom protocol handling for callback processing
- JWT tokens for secure authentication state
- PKCE flow for enhanced security

## Setup

### Prerequisites

1. An Auth0 account
2. An Auth0 application (Regular Web Application type)
3. Configured callback URLs in Auth0 (`vibede://callback`)

### Environment Variables

Set the following environment variables in a `.env.local` file:

```
# Auth0 Configuration
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
NEXT_PUBLIC_AUTH0_CALLBACK_URL=vibede://callback
```

Optional environment variables:
```
NEXT_PUBLIC_AUTH0_AUDIENCE=your-api-audience
NEXT_PUBLIC_AUTH0_SCOPE=openid profile email
```

## Authentication Flow

1. **Initialization**:
   - The Auth0 configuration is loaded from environment variables
   - The Rust backend stores this configuration securely

2. **Login Process**:
   - User clicks the login button in the UI
   - The Rust backend generates a PKCE code challenge and verifier
   - The system browser opens to Auth0's Universal Login page
   - User authenticates with Auth0 (username/password, social login, etc.)
   - Auth0 redirects back to the application using the `vibede://` custom protocol

3. **Callback Handling**:
   - Tauri's URI scheme handler intercepts the `vibede://callback` URL
   - The Rust backend validates the state parameter to prevent CSRF attacks
   - The backend exchanges the authorization code for tokens using the PKCE verifier
   - Auth state is securely stored in memory

4. **Authentication State**:
   - JWT tokens are stored securely in the application's memory
   - The frontend can check authentication state and user information
   - Tokens are refreshed automatically when needed

5. **Logout Process**:
   - User clicks logout in the UI
   - The backend clears the stored tokens
   - The system browser opens to Auth0's logout page
   - Auth0 redirects back to the application

## File Structure

- `src-tauri/src/services/auth_service.rs`: Core authentication service
- `src-tauri/src/commands/auth_commands.rs`: Tauri commands for authentication
- `src-tauri/src/resources/success.html`: Success page shown after authentication
- `src/hooks/useAuth.ts`: React hook for Auth0 authentication
- `src/components/auth/AuthProvider.tsx`: Context provider for authentication
- `src/components/auth/AuthButton.tsx`: Login/logout button component

## Security Considerations

- Uses PKCE flow for enhanced security
- Verifies state parameter to prevent CSRF attacks
- Securely stores tokens in memory (not localStorage)
- Custom protocol handling for secure redirects
- JWT token validation for secure authentication

## Troubleshooting

Common issues:

1. **Auth0 callback not working**:
   - Ensure `vibede://callback` is properly configured in Auth0 dashboard
   - Check that the Tauri configuration has the proper protocol configuration

2. **Authentication fails**:
   - Check Auth0 logs for detailed error information
   - Verify environment variables are set correctly
   - Ensure network connectivity to Auth0 servers

3. **Token validation issues**:
   - Check token expiration and refresh flow
   - Verify that the Auth0 domain and client ID are correct 