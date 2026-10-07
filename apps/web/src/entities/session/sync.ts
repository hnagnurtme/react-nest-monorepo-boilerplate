/**
 * Cross-tab session synchronization via BroadcastChannel.
 *
 * When one tab logs out or refreshes, other tabs are notified to update their state.
 */

import { useEffect } from 'react';

import { useAuthStore } from './store';

type SessionMessage =
  { type: 'logout' } | { type: 'refreshed'; accessToken: string; user: unknown };

const CHANNEL_NAME = 'app_session';

export function useSessionSync(): void {
  useEffect(() => {
    // BroadcastChannel not available in all browsers
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (event: MessageEvent<SessionMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'logout':
          useAuthStore.getState().clearAuth();
          break;

        case 'refreshed':
          useAuthStore.getState().setAuth(message.accessToken, message.user as never);
          break;
      }
    };

    return () => {
      channel.close();
    };
  }, []);
}

/**
 * Broadcast logout to other tabs.
 */
export function broadcastLogout(): void {
  if (typeof BroadcastChannel === 'undefined') return;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: 'logout' } satisfies SessionMessage);
  channel.close();
}

/**
 * Broadcast session refresh to other tabs.
 */
export function broadcastRefreshed(accessToken: string, user: unknown): void {
  if (typeof BroadcastChannel === 'undefined') return;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: 'refreshed', accessToken, user } satisfies SessionMessage);
  channel.close();
}
