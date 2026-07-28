import { ContractData, UserProfile, UserStatus, AuditLog } from '../types';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = viteEnv?.VITE_API_BASE_URL || '';

type RequestOptions = RequestInit & {
  authToken?: string | null;
};

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set(
      'Content-Type',
      headers.get('Content-Type') || 'application/json'
    );
  }

  if (options.authToken) {
    headers.set('Authorization', `Bearer ${options.authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      // Keep the generic status message when the backend does not return JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface SearchContractsResponse {
  results: ContractData[];
  queryCount: number;
  readCount: number;
}

export interface SearchLog {
  id?: string;
  userId: string;
  username: string;
  email?: string;
  searchBy: string;
  searchTerm: string;
  resultsCount: number;
  timestamp: any;
}

export const portalApi = {
  searchContracts(authToken: string | null, searchBy: string, searchTerm: string) {
    return apiRequest<SearchContractsResponse>('/api/contracts/search', {
      method: 'POST',
      authToken,
      body: JSON.stringify({ searchBy, searchTerm })
    });
  },

  listUsers(authToken: string | null) {
    return apiRequest<{ users: UserProfile[]; readCount: number }>('/api/admin/users', {
      authToken
    });
  },

  updateUserStatus(authToken: string | null, uid: string, status: UserStatus) {
    return apiRequest<{ user: UserProfile }>('/api/admin/users/status', {
      method: 'PATCH',
      authToken,
      body: JSON.stringify({ uid, status })
    });
  },

  updateUserRole(authToken: string | null, uid: string, role: 'superadmin' | 'admin' | 'user') {
    return apiRequest<{ user: UserProfile }>('/api/admin/users/role', {
      method: 'PATCH',
      authToken,
      body: JSON.stringify({ uid, role })
    });
  },

  deleteUser(authToken: string | null, uid: string) {
    return apiRequest<void>(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      authToken
    });
  },

  listAuditLogs(authToken: string | null) {
    return apiRequest<{ logs: AuditLog[]; readCount: number }>('/api/admin/audit-logs', {
      authToken
    });
  },

  listSearchLogs(authToken: string | null, all = false) {
    const suffix = all ? '?all=true' : '';
    return apiRequest<{ logs: SearchLog[]; readCount: number }>(`/api/admin/search-logs${suffix}`, {
      authToken
    });
  },

  uploadContracts(authToken: string | null, contracts: ContractData[], sourceFileName?: string) {
    return apiRequest<{
      totalRows: number;
      totalUnique: number;
      duplicatesMerged: number;
    }>('/api/contracts/import', {
      method: 'POST',
      authToken,
      body: JSON.stringify({ contracts, sourceFileName })
    });
  },

  uploadExcel(
    authToken: string | null,
    file: File
  ) {
    const formData = new FormData();

    formData.append('file', file);

    return apiRequest<{
      totalRows: number;
      totalUnique: number;
      duplicatesMerged: number;
    }>('/api/contracts/import', {
      method: 'POST',
      authToken,
      body: formData
    });
  },

  purgeContracts(authToken: string | null) {
    return apiRequest<{ deletedCount: number }>('/api/contracts/purge', {
      method: 'DELETE',
      authToken,
      body: JSON.stringify({ confirm: true, confirmToken: 'PURGE_CONTRACTS' })
    });
  },

  getMyProfile(authToken: string | null) {
    return apiRequest<{ profile: UserProfile }>('/api/me/profile', {
      authToken
    });
  },

  upsertMyProfile(authToken: string | null, profile: Partial<UserProfile>) {
    return apiRequest<{ profile: UserProfile }>('/api/me/profile', {
      method: 'PUT',
      authToken,
      body: JSON.stringify({ profile })
    });
  },

  resolveLoginEmail(username: string) {
    return apiRequest<{ email: string | null }>('/api/auth/resolve-login', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  },

  adb2cCallback(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ) {
    return apiRequest<{
      success: boolean;
      customToken: string;
      user: UserProfile;
    }>('/api/auth/adb2c/callback', {
      method: 'POST',
      body: JSON.stringify({
        code,
        codeVerifier,
        redirectUri
      })
    });
  }
};