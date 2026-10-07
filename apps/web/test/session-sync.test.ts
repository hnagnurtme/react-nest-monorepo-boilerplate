import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/entities/session';
import { broadcastLogout, broadcastRefreshed } from '@/entities/session/sync';

describe('Phase 1: Session Sync (S1-S3)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'anonymous',
      accessToken: null,
      user: null,
    });
  });

  it('S1: BroadcastChannel unavailable, broadcast functions do not throw', () => {
    const originalBC = globalThis.BroadcastChannel;
    // @ts-expect-error - intentionally undefine for test
    globalThis.BroadcastChannel = undefined;

    expect(() => {
      broadcastLogout();
    }).not.toThrow();
    expect(() => {
      broadcastRefreshed('token', { id: 'user-1' });
    }).not.toThrow();

    globalThis.BroadcastChannel = originalBC;
  });

  it('S2: broadcastLogout sends logout message via BroadcastChannel', () => {
    const postMessageMock = vi.fn();
    const closeMock = vi.fn();

    class MockBroadcastChannel {
      constructor(public name: string) {}
      postMessage = postMessageMock;
      close = closeMock;
      onmessage = null;
      onmessageerror = null;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      dispatchEvent = vi.fn();
    }

    globalThis.BroadcastChannel = MockBroadcastChannel;

    broadcastLogout();

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'logout' });
    expect(closeMock).toHaveBeenCalled();
  });

  it('S3: broadcastRefreshed sends refreshed message with accessToken and user', () => {
    const postMessageMock = vi.fn();
    const closeMock = vi.fn();

    class MockBroadcastChannel {
      constructor(public name: string) {}
      postMessage = postMessageMock;
      close = closeMock;
      onmessage = null;
      onmessageerror = null;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      dispatchEvent = vi.fn();
    }

    globalThis.BroadcastChannel = MockBroadcastChannel;

    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockToken = 'new-token';

    broadcastRefreshed(mockToken, mockUser);

    expect(postMessageMock).toHaveBeenCalledWith({
      type: 'refreshed',
      accessToken: mockToken,
      user: mockUser,
    });
    expect(closeMock).toHaveBeenCalled();
  });
});
