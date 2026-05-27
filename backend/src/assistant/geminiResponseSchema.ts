import { ASSISTANT_DRAFT_OPERATION_TYPES } from '../constants/assistant';
import { TASK_PRIORITIES, TASK_STATUSES } from '../constants/task';

export const assistantResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'message', 'draft'],
  properties: {
    schemaVersion: { type: 'number', enum: [1] },
    message: { type: 'string' },
    draft: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['schemaVersion', 'summary', 'operations'],
          properties: {
            schemaVersion: { type: 'number', enum: [1] },
            summary: { type: 'string' },
            operations: {
              type: 'array',
              minItems: 1,
              maxItems: 10,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'type', 'label'],
                properties: {
                  id: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: ASSISTANT_DRAFT_OPERATION_TYPES,
                  },
                  label: { type: 'string' },
                  taskId: { type: 'string' },
                  commentId: { type: 'string' },
                  input: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                      status: { type: 'string', enum: TASK_STATUSES },
                      priority: { type: 'string', enum: TASK_PRIORITIES },
                      content: { type: 'string' },
                    },
                  },
                  patch: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                      status: { type: 'string', enum: TASK_STATUSES },
                      priority: { type: 'string', enum: TASK_PRIORITIES },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  },
} as const;
