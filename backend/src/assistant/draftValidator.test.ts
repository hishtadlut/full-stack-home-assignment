import assert from 'node:assert/strict';
import {
  DraftValidationError,
  normalizeAssistantMessage,
  normalizeDraft,
  normalizeModelResponse,
  parseJsonObject,
} from './draftValidator';

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

assert.equal(normalizedResponse.schemaVersion, 1);
assert.equal(normalizedResponse.draft?.operations.length, 2);
assert.equal(normalizedResponse.draft?.operations[1].id, 'create_task_2');

const fencedJson = parseJsonObject('```json\n{"schemaVersion":1,"message":"ok","draft":null}\n```');
assert.deepEqual(normalizeModelResponse(fencedJson), {
  schemaVersion: 1,
  message: 'ok',
  draft: null,
});

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

assert.equal(normalizedDraft.operations[0].id, 'patch');

assert.throws(
  () =>
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
  DraftValidationError,
);

assert.throws(
  () => normalizeAssistantMessage(' '.repeat(2)),
  DraftValidationError,
);

console.log('Assistant draft validator mock tests passed');
