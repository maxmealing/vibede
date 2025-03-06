/**
 * Type declarations for Tauri API modules
 */

declare module '@tauri-apps/api/dialog' {
  interface OpenDialogOptions {
    defaultPath?: string;
    directory?: boolean;
    multiple?: boolean;
    title?: string;
    filters?: {
      name: string;
      extensions: string[];
    }[];
  }

  /**
   * Open a file/directory selection dialog
   */
  export function open(options?: OpenDialogOptions): Promise<string | string[] | null>;

  /**
   * Open a file/directory save dialog
   */
  export function save(options?: OpenDialogOptions): Promise<string | null>;

  /**
   * Display a confirmation dialog with Yes/No buttons
   */
  export function confirm(message: string, title?: string): Promise<boolean>;

  /**
   * Display a message dialog
   */
  export function message(message: string, title?: string): Promise<void>;
}

declare module '@tauri-apps/api/event' {
  export interface EventCallback<T> {
    (event: { payload: T }): void;
  }

  export type UnlistenFn = () => void;

  /**
   * Listen to an event
   */
  export function listen<T>(event: string, callback: EventCallback<T>): Promise<UnlistenFn>;

  /**
   * Emits an event to the backend
   */
  export function emit(event: string, payload?: unknown): Promise<void>;
}

declare module '@tauri-apps/api/core' {
  /**
   * Invoke a Tauri command
   */
  export function invoke<T = any>(cmd: string, args?: Record<string, unknown>): Promise<T>;
} 