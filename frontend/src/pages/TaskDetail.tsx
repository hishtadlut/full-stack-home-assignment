import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TaskCommentsPanel } from '../components/task-detail/TaskCommentsPanel';
import { TaskDetailHeader } from '../components/task-detail/TaskDetailHeader';
import { TaskDetailShell } from '../components/task-detail/TaskDetailShell';
import { TaskEditPanel } from '../components/task-detail/TaskEditPanel';
import { TaskNotFound } from '../components/task-detail/TaskNotFound';
import { TaskRealtimeActivityFeed } from '../components/task-detail/TaskRealtimeActivityFeed';
import { TaskSidePanels } from '../components/task-detail/TaskSidePanels';
import { LoadingState } from '../components/ui/LoadingState';
import { useAuth } from '../auth/useAuth';
import { commentApi } from '../services/commentApi';
import { ApiRequestError } from '../services/api';
import { taskApi } from '../services/taskApi';
import { userApi } from '../services/userApi';
import { isTaskAssignedToUser } from '../utils/taskVisibility';
import { useTaskRealtime } from '../hooks/useTaskRealtime';
import type { Comment, Task, TaskEditableFields, User } from '../types';

export const TaskDetail = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
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

  const assignedUserIds = useMemo(
    () => task?.assignments?.map((assignment) => assignment.userId) ?? [],
    [task?.assignments],
  );

  const canManageAssignments = Boolean(task && user && task.userId === user.id);
  const canEditTask = Boolean(task && isTaskAssignedToUser(task, user?.id));
  const canComment = Boolean(user && assignedUserIds.includes(user.id));
  const assignmentsChanged = !sameStringSet(assignedUserIds, selectedAssigneeIds);

  const loadTask = useCallback(async (showLoading = true) => {
    if (!taskId) {
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    setError(null);

    try {
      const taskResponse = await taskApi.getTask(taskId);

      if (!isTaskAssignedToUser(taskResponse, user?.id)) {
        setTask(null);
        setComments([]);
        setUsers([]);
        setSelectedAssigneeIds([]);
        setError('Task not found');
        return;
      }

      setTask(taskResponse);
      setComments(taskResponse.comments ?? []);
      setUsers(usersFromTask(taskResponse, user));
      setSelectedAssigneeIds(assigneeIdsForTask(taskResponse));

      userApi.listUsers()
        .then(setUsers)
        .catch(() => {
          setUsers(usersFromTask(taskResponse, user));
        });
    } catch (loadError) {
      if (loadError instanceof ApiRequestError && loadError.status === 404) {
        setTask(null);
        setComments([]);
        setUsers([]);
        setSelectedAssigneeIds([]);
      }
      setError(messageForError(loadError));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [taskId, user]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  const refreshTaskSilently = useCallback(() => {
    void loadTask(false);
  }, [loadTask]);

  const realtimeNotifications = useTaskRealtime({
    taskId,
    currentUserId: user?.id ?? null,
    onExternalTaskChanged: refreshTaskSilently,
  });

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

    if (!canComment) {
      setError('Only assigned users can comment on this task');
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

  const handleAssigneeToggle = (userId: string) => {
    setSelectedAssigneeIds((current) =>
      current.includes(userId)
        ? current.filter((selectedUserId) => selectedUserId !== userId)
        : [...current, userId],
    );
  };

  const handleSaveAssignments = async () => {
    if (!taskId) {
      return;
    }

    setAssignmentSaving(true);
    setError(null);

    try {
      const updatedTask = await taskApi.updateTaskAssignments(taskId, selectedAssigneeIds);
      setTask(updatedTask);
      setSelectedAssigneeIds(updatedTask.assignments?.map((assignment) => assignment.userId) ?? []);
    } catch (assignmentError) {
      setError(messageForError(assignmentError));
    } finally {
      setAssignmentSaving(false);
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
            canEditTask={canEditTask}
            canDeleteTask={canManageAssignments}
            error={error}
            onToggleEdit={() => setEditing((current) => !current)}
            onDelete={handleDeleteTask}
          />

          <TaskRealtimeActivityFeed notifications={realtimeNotifications} />

          {editing && editableTask && (
            <TaskEditPanel busy={saving} initialValues={editableTask} onSubmit={handleSave} />
          )}

          <TaskCommentsPanel
            comments={comments}
            commentText={commentText}
            saving={saving}
            canComment={canComment}
            currentUserId={user?.id ?? null}
            taskOwnerId={task.userId}
            onCommentTextChange={setCommentText}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
          />
        </section>

        <TaskSidePanels
          task={task}
          users={users}
          selectedAssigneeIds={selectedAssigneeIds}
          assignmentSaving={assignmentSaving}
          assignmentsChanged={assignmentsChanged}
          canManageAssignments={canManageAssignments}
          onAssigneeToggle={handleAssigneeToggle}
          onSaveAssignments={handleSaveAssignments}
        />
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

const assigneeIdsForTask = (task: Task) =>
  task.assignments?.map((assignment) => assignment.userId) ?? [];

const usersFromTask = (task: Task, currentUser: User | null) => {
  const usersById = new Map<string, User>();

  task.assignments?.forEach((assignment) => {
    if (assignment.user) {
      usersById.set(assignment.user.id, assignment.user);
    }
  });

  if (currentUser && task.userId === currentUser.id) {
    usersById.set(currentUser.id, currentUser);
  }

  return [...usersById.values()];
};

const sameStringSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);
  return left.every((value) => rightValues.has(value));
};
