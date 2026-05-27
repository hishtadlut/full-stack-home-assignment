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
  taskContext,
}: GenerateAssistantResponseInput): Promise<AssistantModelResponse> => {
  const [{ ThinkingLevel }, client] = await Promise.all([getGenAiModule(), getAiClient()]);

  const response = await client.models.generateContent({
    model: ASSISTANT_MODEL,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
      responseMimeType: 'application/json',
      responseJsonSchema: assistantResponseJsonSchema,
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: buildPrompt(userMessage, recentMessages, taskContext),
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
  taskContext: unknown,
) => `
You are a task-management assistant embedded in a production task app.

You can help the user query, create, update, and delete tasks, and query, create, and delete comments.
Auth is not available to you and must never be drafted.

Read operations are safe:
- Answer questions directly from TASK_CONTEXT.
- If the user asks to list, count, find, summarize, or inspect tasks/comments, return draft: null.

Write operations require a draft:
- Never say you already changed data.
- Return a structured draft for create_task, update_task, delete_task, create_comment, or delete_comment.
- The UI will render this draft as an editable form and the backend will execute it only after approval.
- If the user references a task or comment ambiguously, ask a follow-up question and return draft: null.
- If a requested operation is not supported by the available API, explain that and return draft: null.

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
        "taskId": "required for update_task/delete_task/create_comment",
        "commentId": "required for delete_comment",
        "input": { "title": "for create_task", "description": null, "status": "TODO", "priority": "MEDIUM", "content": "for create_comment" },
        "patch": { "title": "optional", "description": null, "status": "TODO", "priority": "MEDIUM" }
      }
    ]
  }
}

For create_comment, input must contain only content.
For create_task, input must contain title and may contain description/status/priority.
For update_task, patch must contain at least one task field.
For delete_task, include taskId and no input or patch.
For delete_comment, include commentId and no input or patch.

RECENT_MESSAGES:
${JSON.stringify([...recentMessages].reverse(), null, 2)}

TASK_CONTEXT:
${JSON.stringify(taskContext, null, 2)}

USER_MESSAGE:
${userMessage}
`.trim();
