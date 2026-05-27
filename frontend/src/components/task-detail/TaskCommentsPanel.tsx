import type { FormEvent } from 'react';
import { MessageSquare, Trash2, UserRound } from 'lucide-react';
import type { Comment } from '../../types';
import { formatFullDateTime } from '../../utils/taskFormatting';
import { buttonStyles } from '../ui/buttonStyles';

interface TaskCommentsPanelProps {
  comments: Comment[];
  commentText: string;
  saving: boolean;
  onCommentTextChange: (value: string) => void;
  onAddComment: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
}

export const TaskCommentsPanel = ({
  comments,
  commentText,
  saving,
  onCommentTextChange,
  onAddComment,
  onDeleteComment,
}: TaskCommentsPanelProps) => (
  <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" aria-labelledby="comments-title">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          Comments
        </p>
        <h2 id="comments-title" className="text-xl font-bold text-zinc-950">
          Discussion ({comments.length})
        </h2>
      </div>
    </div>

    <form onSubmit={onAddComment} className="mb-5 grid gap-3">
      <label htmlFor="comment-content" className="text-sm font-semibold text-zinc-700">
        Add comment
      </label>
      <textarea
        id="comment-content"
        value={commentText}
        onChange={(event) => onCommentTextChange(event.target.value)}
        rows={4}
        placeholder="Add context, decisions, blockers, or handoff notes."
        className="w-full resize-none rounded border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || commentText.trim().length === 0}
          className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          Add Comment
        </button>
      </div>
    </form>

    <div className="grid gap-3">
      {comments.length === 0 ? (
        <p className="rounded border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
          No comments yet.
        </p>
      ) : (
        comments.map((comment) => (
          <article key={comment.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-white text-zinc-700">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-zinc-950">
                    {comment.user?.name || comment.user?.username || 'Unknown user'}
                  </p>
                  <p className="text-xs text-zinc-500">{formatFullDateTime(comment.createdAt)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDeleteComment(comment.id)}
                disabled={saving}
                className={`${buttonStyles('danger')} px-2 py-1 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{comment.content}</p>
          </article>
        ))
      )}
    </div>
  </section>
);
