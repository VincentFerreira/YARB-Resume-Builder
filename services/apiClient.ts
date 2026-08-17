const API_BASE = `http://${window.location.hostname}:3001/api`;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  try {
    const body = await res.json();
    return new ApiError(res.status, body?.error?.message ?? fallback, body?.error?.code);
  } catch {
    return new ApiError(res.status, fallback);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, fallbackError = 'Request failed'): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw await toApiError(res, fallbackError);
  return res.json();
}
