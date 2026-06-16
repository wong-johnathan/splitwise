const API_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || res.statusText, res.status, body.details);
  }

  return res.json();
}

export const api = {
  // Auth
  register: (data: { email: string; name: string; password: string }) =>
    request<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => request<{ user: any }>('/api/auth/me'),

  // Groups
  getGroups: () => request<{ groups: any[] }>('/api/groups'),

  getGroup: (id: number) =>
    request<{ group: any; members: any[]; balances: any[]; debts: any[] }>(`/api/groups/${id}`),

  createGroup: (data: { name: string; description?: string; memberIds?: number[] }) =>
    request<{ group: any }>('/api/groups', { method: 'POST', body: JSON.stringify(data) }),

  searchUsers: (q: string) =>
    request<{ users: any[] }>(`/api/users/search?q=${encodeURIComponent(q)}`),

  addGroupMember: (groupId: number, userId: number) =>
    request<{ member: any }>(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Expenses
  getExpenses: (groupId: number) =>
    request<{ expenses: any[] }>(`/api/expenses?groupId=${groupId}`),

  getExpense: (id: number) =>
    request<{ expense: any; splits: any[] }>(`/api/expenses/${id}`),

  createExpense: (data: {
    groupId: number;
    description: string;
    amount: number;
    splitMethod?: string;
    paidBy?: number;
    splits?: { userId: number; amount: number; percentage?: number }[];
    memberIds?: number[];
    date?: string;
  }) =>
    request<{ expense: any; splits: any[] }>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateExpense: (id: number, data: {
    description: string;
    amount: number;
    splitMethod?: string;
    paidBy?: number;
    splits?: { userId: number; amount: number; percentage?: number }[];
    memberIds?: number[];
    date?: string;
  }) =>
    request<{ expense: any; splits: any[] }>(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteExpense: (id: number) =>
    request<{ message: string }>(`/api/expenses/${id}`, { method: 'DELETE' }),

  // Payments
  getPayments: (groupId: number) =>
    request<{ payments: any[] }>(`/api/payments?groupId=${groupId}`),

  createPayment: (data: { groupId: number; fromUser?: number; toUser: number; amount: number; note?: string; date?: string }) =>
    request<{ payment: any }>('/api/payments', { method: 'POST', body: JSON.stringify(data) }),
};
