import { useEffect, useState } from 'react';
import { assistantApi } from '../../services/assistantApi';
import type {
  AssistantChat,
  AssistantDraftOperation,
  AssistantDraftRecord,
  AssistantDraftShape,
} from '../../types';
import { DraftOperationForm } from './DraftOperationForm';

interface DraftCardProps {
  draftRecord: AssistantDraftRecord;
  onExecuted: (chat: AssistantChat) => Promise<void>;
  onDiscarded: (chat: AssistantChat) => Promise<void>;
}

export const DraftCard = ({ draftRecord, onExecuted, onDiscarded }: DraftCardProps) => {
  const [draft, setDraft] = useState<AssistantDraftShape>(
    draftRecord.approvedDraft ?? draftRecord.originalDraft,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPending = draftRecord.status === 'PENDING';
  const containsDelete = draft.operations.some(
    (operation) => operation.type === 'delete_task' || operation.type === 'delete_comment',
  );

  useEffect(() => {
    setDraft(draftRecord.approvedDraft ?? draftRecord.originalDraft);
  }, [draftRecord.id, draftRecord.approvedDraft, draftRecord.originalDraft]);

  const updateOperation = (
    operationId: string,
    updater: (operation: AssistantDraftOperation) => AssistantDraftOperation,
  ) => {
    setDraft((current) => ({
      ...current,
      operations: current.operations.map((operation) =>
        operation.id === operationId ? updater(operation) : operation,
      ),
    }));
  };

  const execute = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await assistantApi.executeDraft(draftRecord.id, draft);
      await onExecuted(response.chat);
    } catch (executeError) {
      setError(messageForError(executeError));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await assistantApi.discardDraft(draftRecord.id);
      await onDiscarded(response.chat);
    } catch (discardError) {
      setError(messageForError(discardError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={`Assistant draft: ${draft.summary}`}
      className="mt-2 rounded-lg border border-cyan-100 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-cyan-700">
            Draft {draftRecord.status.toLowerCase()}
          </p>
          <h4 className="text-sm font-bold text-gray-900">{draft.summary}</h4>
        </div>
        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
          {draft.operations.length} op{draft.operations.length === 1 ? '' : 's'}
        </span>
      </div>

      {containsDelete && isPending && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          This draft includes a delete operation. Review the target carefully before approving.
        </div>
      )}

      <div className="space-y-3">
        {draft.operations.map((operation) => (
          <DraftOperationForm
            key={operation.id}
            operation={operation}
            disabled={!isPending || busy}
            onChange={(updatedOperation) => updateOperation(operation.id, () => updatedOperation)}
          />
        ))}
      </div>

      {draftRecord.executionResult && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          {draftRecord.executionResult.ok ? 'Executed successfully.' : 'Execution failed.'}
        </div>
      )}

      {error && <div role="alert" className="mt-3 text-sm text-red-700">{error}</div>}

      {isPending && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={discard}
            disabled={busy}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={execute}
            disabled={busy}
            aria-label={containsDelete ? 'Delete Task' : 'Apply Draft'}
            className={`rounded px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              containsDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {containsDelete ? 'Delete Task' : 'Apply Draft'}
          </button>
        </div>
      )}
    </section>
  );
};

const messageForError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
};
