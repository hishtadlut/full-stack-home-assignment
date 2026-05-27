import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readBackendFile = (relativePath: string) =>
  readFile(path.join(process.cwd(), relativePath), 'utf8');

const modelBody = (schema: string, modelName: string) => {
  const match = schema.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
};

describe('database contracts', () => {
  it('keeps task search backed by a PostgreSQL GIN full-text index', async () => {
    const migration = await readBackendFile(
      'prisma/migrations/20260528010000_add_task_full_text_search_index/migration.sql',
    );

    expect(migration).toContain('CREATE INDEX "Task_full_text_search_idx"');
    expect(migration).toContain('USING GIN');
    expect(migration).toContain("to_tsvector('english', coalesce(\"title\", '') || ' ' || coalesce(\"description\", ''))");
  });

  it.each(['Comment', 'TaskAssignment', 'TaskTag'])(
    'keeps %s task relations configured for Prisma-level cascade semantics',
    async (modelName) => {
      const schema = await readBackendFile('prisma/schema.prisma');

      expect(modelBody(schema, modelName)).toContain(
        'task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)',
      );
    },
  );

  it.each(['Comment', 'TaskAssignment', 'TaskTag'])(
    'adds database-level ON DELETE CASCADE for %s task foreign keys',
    async (tableName) => {
      const migration = await readBackendFile(
        'prisma/migrations/20260528020000_add_task_delete_cascades/migration.sql',
      );

      expect(migration).toMatch(
        new RegExp(
          `ALTER TABLE "${tableName}"[\\s\\S]*?ADD CONSTRAINT "${tableName}_taskId_fkey"` +
            `[\\s\\S]*?FOREIGN KEY \\("taskId"\\) REFERENCES "Task"\\("id"\\)` +
            '[\\s\\S]*?ON DELETE CASCADE ON UPDATE CASCADE;',
        ),
      );
    },
  );
});
