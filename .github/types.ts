export interface Post {
  id: string;
  content: string;
  date: string;
  likes: number;
  imageUrl?: string;
  originalAuthor: string;
}

export enum AppStep {
  LOGIN = 'LOGIN',
  FILTER_INPUT = 'FILTER_INPUT',
  REVIEW = 'REVIEW',
  EDIT_PREVIEW = 'EDIT_PREVIEW',
  MIGRATING = 'MIGRATING',
  COMPLETED = 'COMPLETED'
}

export type MigrationMode = 'PROFILE_TO_PAGE' | 'PAGE_TO_PAGE';
export type Language = 'en' | 'pl' | 'de';

export interface FilterResult {
  relevantPostIds: string[];
  reasoning?: string;
}

// Mock User Interface
export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  handle: string;
}

// Interface for Facebook Pages
export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  picture?: {
    data: {
      url: string;
    }
  };
}

// Facebook SDK Types
export interface FacebookAuthResponse {
  accessToken: string;
  expiresIn: string;
  signedRequest: string;
  userID: string;
  grantedScopes?: string;
}

export interface FacebookLoginStatus {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse: FacebookAuthResponse | null;
}

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginStatus) => void,
        params?: { scope: string; return_scopes?: boolean; auth_type?: string }
      ) => void;
      api: (path: string, callback: (response: any) => void) => void;
      getLoginStatus: (callback: (response: FacebookLoginStatus) => void) => void;
      logout: (callback: (response: any) => void) => void;
    };
  }
}