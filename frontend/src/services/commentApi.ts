import { api } from './api';
import type { Comment } from '../types';

export const commentApi = {
  async listComments(taskId: string) {
    return api.get<Comment[]>(`/comments?taskId=${encodeURIComponent(taskId)}`);
  },

  async createComment(taskId: string, content: string) {
    return api.post<Comment>('/comments', {
      taskId,
      content,
    });
  },

  async deleteComment(commentId: string) {
    await api.delete(`/comments/${commentId}`);
  },
};
