import { ASSISTANT_DRAFT_OPERATION_TYPES, ASSISTANT_MODEL } from '../constants/assistant';
import { TASK_PRIORITIES, TASK_STATUSES } from '../constants/task';
import { normalizeModelResponse, parseJsonObject } from './draftValidator';
import { assistantResponseJsonSchema } from './geminiResponseSchema';
import type { GenerateAssistantResponseInput, GenAiModule, GoogleGenAIClient } from './geminiTypes';
import type { AssistantModelResponse } from './types';

let genAiModulePromise: Promise<GenAiModule> | null = null;
let aiClient: GoogleGenAIClient | null = null;

export const generateAssistantResponse = async ({
  userMessage,
  recentMessages,
  pendingDraft,
  taskContext,
}: GenerateAssistantResponseInput): Promise<AssistantModelResponse> => {
  const [{ ThinkingLevel }, client] = await Promise.all([getGenAiModule(), getAiClient()]);

  const response = await client.models.generateContent({
    model: ASSISTANT_MODEL,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MEDIUM,
      },
      responseMimeType: 'application/json',
      responseJsonSchema: assistantResponseJsonSchema,
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: buildPrompt(userMessage, recentMessages, pendingDraft, taskContext),
          },
        ],
      },
    ],
  });

  const text = response.text;

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  return normalizeModelResponse(parseJsonObject(text));
};

const getGenAiModule = () => {
  genAiModulePromise ||= import('@google/genai') as Promise<GenAiModule>;
  return genAiModulePromise;
};

const getAiClient = async () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!aiClient) {
    const { GoogleGenAI } = await getGenAiModule();

    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  return aiClient;
};

const buildPrompt = (
  userMessage: string,
  recentMessages: GenerateAssistantResponseInput['recentMessages'],
  pendingDraft: unknown,
  taskContext: unknown,
) => `
You are a task-management assistant embedded in a production task app.

You can help the user query, create, update, assign, unassign, and delete tasks, and query, create, and delete comments.
Auth is not available to you and must never be drafted.

Read operations are safe:
- Answer questions directly from TASK_CONTEXT.
- If the user asks to list, count, find, summarize, or inspect tasks/comments, return draft: null.

Write operations require a draft:
- Never say you already changed data.
- Return a structured draft for create_task, update_task, delete_task, assign_task, unassign_task, create_comment, or delete_comment.
- The UI will render this draft as an editable form and the backend will execute it only after approval.
- If the user references a task or comment ambiguously, ask a follow-up question and return draft: null.
- If the user asks to assign/unassign someone by name or username, use the matching user id from TASK_CONTEXT.users.
- If a requested operation is not supported by the available API, explain that and return draft: null.

Draft revision behavior:
- CURRENT_PENDING_DRAFT is the active unapproved draft, if any.
- If CURRENT_PENDING_DRAFT exists and the user asks to fix, change, update, adjust, rename, or otherwise modify "it", "this", "the draft", or a field without naming a saved task, revise CURRENT_PENDING_DRAFT.
- A revision must return a complete replacement draft with every operation still present, not only the changed field.
- Do not ask which saved task the user means when the request clearly refers to CURRENT_PENDING_DRAFT.
- If no pending draft exists but RECENT_MESSAGES contains a discarded or superseded draft and the user asks to change that prior draft, create a new draft based on that prior draft.
- If the user asks a normal question while a draft is pending, answer the question and return draft: null. The pending draft remains available.

Supported task statuses: ${TASK_STATUSES.join(', ')}
Supported task priorities: ${TASK_PRIORITIES.join(', ')}
Supported draft operations: ${ASSISTANT_DRAFT_OPERATION_TYPES.join(', ')}

Return only JSON matching this shape:
{
  "schemaVersion": 1,
  "message": "short user-facing answer",
  "draft": null | {
    "schemaVersion": 1,
    "summary": "what will happen if approved",
    "operations": [
      {
        "id": "stable_snake_case_operation_id",
        "type": "${ASSISTANT_DRAFT_OPERATION_TYPES.join(' | ')}",
        "label": "short label",
        "taskId": "required for update_task/delete_task/assign_task/unassign_task/create_comment",
        "userId": "required for assign_task/unassign_task",
        "commentId": "required for delete_comment",
        "input": { "title": "for create_task", "description": null, "status": "TODO", "priority": "MEDIUM", "content": "for create_comment" },
        "patch": { "title": "optional", "description": null, "status": "TODO", "priority": "MEDIUM" }
      }
    ]
  }
}

For create_comment, input must contain only content.
For create_comment, draft only when TASK_CONTEXT shows the current user is assigned to the task. Otherwise explain that only assigned users can comment and return draft: null.
For create_task, input must contain title and may contain description/status/priority.
For create_task, infer useful missing fields only when the user intent is clear.
For update_task, patch must contain at least one task field.
For delete_task, include taskId and no input or patch.
For assign_task and unassign_task, include taskId and userId and no input or patch.
For delete_comment, include commentId and no input or patch.

RECENT_MESSAGES:
${JSON.stringify([...recentMessages].reverse(), null, 2)}

CURRENT_PENDING_DRAFT:
${JSON.stringify(pendingDraft, null, 2)}

TASK_CONTEXT:
${JSON.stringify(taskContext, null, 2)}

USER_MESSAGE:
${userMessage}
`.trim();
