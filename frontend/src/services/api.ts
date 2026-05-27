const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiError {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(response: Response, body: unknown) {
    super(messageForApiError(response, body));
    this.name = 'ApiRequestError';
    this.status = response.status;
    this.body = body;
  }
}

export const api = {
  async get<T = unknown>(endpoint: string): Promise<T> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      
      if (!response.ok) {
        throw new ApiRequestError(response, await readErrorBody(response));
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  },

  async post<T = unknown>(endpoint: string, data: unknown): Promise<T> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new ApiRequestError(response, await readErrorBody(response));
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  },

  async patch<T = unknown>(endpoint: string, data: unknown): Promise<T> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new ApiRequestError(response, await readErrorBody(response));
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  },

  async delete<T = unknown>(endpoint: string): Promise<T | null> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      
      if (response.status === 204) {
        return null;
      }
      
      if (!response.ok) {
        throw new ApiRequestError(response, await readErrorBody(response));
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  },
};

const readErrorBody = async (response: Response): Promise<unknown> =>
  response.json().catch(() => null);

const messageForApiError = (response: Response, body: unknown) => {
  if (isApiError(body)) {
    return body.error || body.message || `HTTP ${response.status}`;
  }

  return `HTTP ${response.status}`;
};

const isApiError = (value: unknown): value is ApiError =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
