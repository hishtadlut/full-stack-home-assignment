import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TaskCommentsPanel } from '../components/task-detail/TaskCommentsPanel';
import { TaskDetailHeader } from '../components/task-detail/TaskDetailHeader';
import { TaskDetailShell } from '../components/task-detail/TaskDetailShell';
import { TaskEditPanel } from '../components/task-detail/TaskEditPanel';
import { TaskNotFound } from '../components/task-detail/TaskNotFound';
import { TaskSidePanels } from '../components/task-detail/TaskSidePanels';
import { LoadingState } from '../components/ui/LoadingState';
import { commentApi } from '../services/commentApi';
import { taskApi } from '../services/taskApi';
import type { Comment, Task, TaskEditableFields } from '../types';

export const TaskDetail = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editableTask = useMemo<TaskEditableFields | null>(() => {
    if (!task) {
      return null;
    }

    return {
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
    };
  }, [task]);

  const loadTask = useCallback(async () => {
    if (!taskId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [taskResponse, commentsResponse] = await Promise.all([
        taskApi.getTask(taskId),
        commentApi.listComments(taskId),
      ]);

      setTask(taskResponse);
      setComments(commentsResponse);
    } catch (loadError) {
      setError(messageForError(loadError));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  const handleSave = async (fields: TaskEditableFields) => {
    if (!taskId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedTask = await taskApi.updateTask(taskId, fields);
      setTask(updatedTask);
      setEditing(false);
    } catch (saveError) {
      setError(messageForError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!taskId || commentText.trim().length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const createdComment = await commentApi.createComment(taskId, commentText.trim());
      setComments((current) => [createdComment, ...current]);
      setCommentText('');
    } catch (commentError) {
      setError(messageForError(commentError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setSaving(true);
    setError(null);

    try {
      await commentApi.deleteComment(commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch (deleteError) {
      setError(messageForError(deleteError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await taskApi.deleteTask(taskId);
      navigate('/dashboard');
    } catch (deleteError) {
      setError(messageForError(deleteError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <TaskDetailShell onTasksChanged={loadTask}>
        <LoadingState label="Loading task detail..." />
      </TaskDetailShell>
    );
  }

  if (!task) {
    return (
      <TaskDetailShell onTasksChanged={loadTask}>
        <TaskNotFound error={error} />
      </TaskDetailShell>
    );
  }

  return (
    <TaskDetailShell onTasksChanged={loadTask}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="grid gap-4">
          <TaskDetailHeader
            task={task}
            editing={editing}
            saving={saving}
            error={error}
            onToggleEdit={() => setEditing((current) => !current)}
            onDelete={handleDeleteTask}
          />

          {editing && editableTask && (
            <TaskEditPanel busy={saving} initialValues={editableTask} onSubmit={handleSave} />
          )}

          <TaskCommentsPanel
            comments={comments}
            commentText={commentText}
            saving={saving}
            onCommentTextChange={setCommentText}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
          />
        </section>

        <TaskSidePanels task={task} />
      </div>
    </TaskDetailShell>
  );
};

const messageForError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
};
