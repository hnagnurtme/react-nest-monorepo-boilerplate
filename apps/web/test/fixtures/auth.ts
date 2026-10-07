import { useAuthStore, type PublicUser } from '@/entities/session';

export interface AuthBody {
  accessToken: string;
  user: PublicUser;
  csrfToken?: string;
  refreshToken?: string;
}

export function makeUser(overrides?: Partial<PublicUser>): PublicUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'TENANT_MEMBER',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

export function makeRefreshResponse(overrides?: Partial<AuthBody>): { data: AuthBody } {
  return {
    data: {
      accessToken: 'mock-access-token',
      user: makeUser(),
      csrfToken: 'mock-csrf-token',
      ...overrides,
    },
  };
}

export function problem(
  status: number,
  code: string,
  detail?: string,
): {
  status: number;
  title: string;
  code: string;
  detail: string;
  traceId: string;
} {
  return {
    status,
    title: code
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' '),
    code,
    detail: detail ?? `Error: ${code}`,
    traceId: 'trace-123',
  };
}

export function setSessionUser(user: PublicUser): void {
  useAuthStore.setState({ status: 'authenticated', accessToken: 'token', user });
}
