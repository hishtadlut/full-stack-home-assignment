export interface GenerateAssistantResponseInput {
  userMessage: string;
  recentMessages: Array<{
    role: string;
    content: string;
    createdAt: Date;
  }>;
  taskContext: unknown;
}

export interface GoogleGenAIClient {
  models: {
    generateContent: (params: {
      model: string;
      config: unknown;
      contents: unknown;
    }) => Promise<{ text?: string }>;
  };
}

export interface GenAiModule {
  GoogleGenAI: new (config: { apiKey: string }) => GoogleGenAIClient;
  ThinkingLevel: {
    MINIMAL: string;
  };
}
