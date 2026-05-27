import { useMemo, useState } from 'react';
import { AssistantPanel } from '../components/AssistantPanel';
import { CreateTaskDialog } from '../components/dashboard/CreateTaskDialog';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { TaskBoard } from '../components/dashboard/TaskBoard';
import { TaskFiltersBar } from '../components/dashboard/TaskFiltersBar';
import { TaskMetrics } from '../components/dashboard/TaskMetrics';
import { TaskTable } from '../components/dashboard/TaskTable';
import { useAuth } from '../auth/useAuth';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTasks } from '../hooks/useTasks';
import { buildTaskStats } from '../utils/taskFormatting';
import type { TaskEditableFields, UpdateTaskInput } from '../types';

export const Dashboard = () => {
  const [showForm, setShowForm] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { logout, user } = useAuth();
  const {
    search,
    status,
    priority,
    view,
    filters,
    hasFilters,
    setFilterParam,
    clearFilters,
  } = useTaskFilters();

  const { tasks, loading, error, createTask, updateTask, deleteTask, refetch } = useTasks(filters);
  const stats = useMemo(() => buildTaskStats(tasks), [tasks]);

  const handleCreateTask = async (taskData: TaskEditableFields) => {
    setCreateBusy(true);
    setActionError(null);

    try {
      await createTask(taskData);
      setShowForm(false);
    } catch (createError) {
      setActionError(messageForError(createError));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setActionError(null);

    try {
      await deleteTask(taskId);
    } catch (deleteError) {
      setActionError(messageForError(deleteError));
    }
  };

  const handleUpdateTask = async (taskId: string, taskData: UpdateTaskInput) => {
    setActionError(null);

    try {
      await updateTask(taskId, taskData);
    } catch (updateError) {
      setActionError(messageForError(updateError));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <DashboardHeader
        user={user}
        view={view}
        onViewChange={(nextView) => setFilterParam('view', nextView)}
        onNewTask={() => setShowForm(true)}
        onLogout={logout}
      />

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <TaskMetrics stats={stats} />

        <TaskFiltersBar
          search={search}
          status={status}
          priority={priority}
          resultCount={tasks.length}
          hasFilters={hasFilters}
          onFilterChange={setFilterParam}
          onClearFilters={clearFilters}
        />

        {(error || actionError) && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {error || actionError}
          </div>
        )}

        {view === 'board' ? (
          <TaskBoard
            tasks={tasks}
            loading={loading}
            onUpdate={handleUpdateTask}
            onDelete={handleDeleteTask}
          />
        ) : (
          <TaskTable
            tasks={tasks}
            loading={loading}
            onUpdate={handleUpdateTask}
            onDelete={handleDeleteTask}
          />
        )}
      </main>

      {showForm && (
        <CreateTaskDialog
          busy={createBusy}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateTask}
        />
      )}

      <AssistantPanel onTasksChanged={refetch} />
    </div>
  );
};

const messageForError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
};
