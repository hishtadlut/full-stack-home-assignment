import { describe, expect, it } from 'vitest';
import {
  DraftValidationError,
  normalizeAssistantMessage,
  normalizeDraft,
  normalizeModelResponse,
  parseJsonObject,
} from './draftValidator';

describe('assistant draft validation', () => {
  it('normalizes model responses and duplicate operation ids', () => {
    const normalizedResponse = normalizeModelResponse({
      schemaVersion: 1,
      message: 'I drafted the change.',
      draft: {
        schemaVersion: 1,
        summary: 'Create a task and comment on another task',
        operations: [
          {
            id: 'create_task',
            type: 'create_task',
            label: 'Create task',
            input: {
              title: 'Write assistant tests',
              description: 'Cover short and long chats',
              status: 'TODO',
              priority: 'HIGH',
            },
          },
          {
            id: 'create_task',
            type: 'create_comment',
            label: 'Create comment',
            taskId: 'task-1',
            input: {
              content: 'Follow up after review',
            },
          },
        ],
      },
    });

    expect(normalizedResponse.schemaVersion).toBe(1);
    expect(normalizedResponse.draft?.operations).toHaveLength(2);
    expect(normalizedResponse.draft?.operations[1].id).toBe('create_task_2');
  });

  it('parses fenced JSON and accepts a response without a draft', () => {
    const fencedJson = parseJsonObject('```json\n{"schemaVersion":1,"message":"ok","draft":null}\n```');

    expect(normalizeModelResponse(fencedJson)).toEqual({
      schemaVersion: 1,
      message: 'ok',
      draft: null,
    });
  });

  it('normalizes task update drafts', () => {
    const normalizedDraft = normalizeDraft({
      schemaVersion: 1,
      summary: 'Patch a task',
      operations: [
        {
          id: 'patch',
          type: 'update_task',
          label: 'Patch task',
          taskId: ' task-1 ',
          patch: {
            title: 'Updated title',
          },
        },
      ],
    });

    expect(normalizedDraft.operations[0].id).toBe('patch');
  });

  it('rejects invalid draft status values', () => {
    expect(() =>
      normalizeDraft({
        schemaVersion: 1,
        summary: 'Bad status',
        operations: [
          {
            id: 'bad',
            type: 'create_task',
            label: 'Create task',
            input: {
              title: 'Bad task',
              status: 'BLOCKED',
            },
          },
        ],
      }),
    ).toThrow(DraftValidationError);
  });

  it('rejects blank assistant messages', () => {
    expect(() => normalizeAssistantMessage(' '.repeat(2))).toThrow(DraftValidationError);
  });

  it('rejects empty task update patches', () => {
    expect(() =>
      normalizeDraft({
        schemaVersion: 1,
        summary: 'Patch a task',
        operations: [
          {
            type: 'update_task',
            taskId: 'task-1',
            patch: {},
          },
        ],
      }),
    ).toThrow(DraftValidationError);
  });

  it('normalizes delete operations with fallback labels', () => {
    const normalizedDraft = normalizeDraft({
      schemaVersion: 1,
      summary: 'Delete task and comment',
      operations: [
        {
          type: 'delete_task',
          taskId: 'task-1',
        },
        {
          type: 'delete_comment',
          commentId: 'comment-1',
        },
      ],
    });

    expect(normalizedDraft.operations[0]).toMatchObject({
      id: 'operation_1',
      label: 'Delete task',
    });
    expect(normalizedDraft.operations[1]).toMatchObject({
      id: 'operation_2',
      label: 'Delete comment',
    });
  });
});
