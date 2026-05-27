import { api } from './api';
import type { UserListResponse } from '../types';

export const userApi = {
  async listUsers() {
    const response = await api.get<UserListResponse>('/users');
    return response.users;
  },
};
