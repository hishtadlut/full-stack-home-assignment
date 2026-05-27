import { useState } from 'react';
import { TASK_PRIORITIES, TASK_STATUSES } from '../types';
import type { Task, TaskEditableFields, TaskPriority, TaskStatus, UpdateTaskInput } from '../types';

const toTaskEditableFields = (task: Task): TaskEditableFields => ({
  title: task.title,
  description: task.description ?? '',
  status: task.status,
  priority: task.priority,
});

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  updateTask: (id: string, taskData: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
}

export const TaskList = ({ tasks, loading, updateTask, deleteTask }: TaskListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<TaskEditableFields | null>(null);

  const handleEditClick = (task: Task) => {
    setEditingId(task.id);
    setEditFormData(toTaskEditableFields(task));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const handleSaveEdit = async (taskId: string) => {
    if (!editFormData) {
      return;
    }

    try {
      await updateTask(taskId, editFormData);
      setEditingId(null);
      setEditFormData(null);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const updateEditedTaskFields = (updatedFields: Partial<TaskEditableFields>) => {
    setEditFormData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        ...updatedFields,
      };
    });
  };

  if (loading) {
    return <div className="p-4">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          {editingId === task.id && editFormData ? (
            // Edit mode
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => updateEditedTaskFields({ title: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => updateEditedTaskFields({ description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => updateEditedTaskFields({ status: e.target.value as TaskStatus })}
                    className="w-full border rounded px-3 py-2"
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <select
                    value={editFormData.priority}
                    onChange={(e) => updateEditedTaskFields({ priority: e.target.value as TaskPriority })}
                    className="w-full border rounded px-3 py-2"
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveEdit(task.id)}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            // View mode
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{task.title}</h3>
                <p className="text-gray-600 mt-1 whitespace-pre-wrap">{task.description || ''}</p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {task.status}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                    {task.priority}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditClick(task)}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
