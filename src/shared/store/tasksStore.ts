import { create } from 'zustand';
import type { TaskEntity } from '../types/entities';
import type { TaskStatus, TaskType } from '../types';
import { queryTasks, countTasks, deleteTasks, clearCompletedTasks, addTask, updateTask } from '../db/tasks';

interface TasksState {
  tasks: TaskEntity[];
  total: number;
  loading: boolean;
  filters: {
    status?: TaskStatus;
    taskType?: TaskType;
  };
  
  fetchTasks: (status?: TaskStatus, taskType?: TaskType) => Promise<void>;
  createTask: (task: Omit<TaskEntity, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTaskStatus: (id: string, updates: Partial<TaskEntity>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  retryTask: (id: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  total: 0,
  loading: false,
  filters: {},
  
  fetchTasks: async (status?: TaskStatus, taskType?: TaskType) => {
    set({ loading: true });
    try {
      const filters: { status?: TaskStatus; taskType?: TaskType } = {};
      if (status) filters.status = status;
      if (taskType) filters.taskType = taskType;
      
      const [tasks, total] = await Promise.all([
        queryTasks(filters),
        countTasks(filters)
      ]);
      set({ tasks, total, filters, loading: false });
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      set({ loading: false });
    }
  },
  
  createTask: async (task) => {
    const id = await addTask(task);
    await get().fetchTasks();
    return id;
  },
  
  updateTaskStatus: async (id, updates) => {
    await updateTask(id, updates);
    await get().fetchTasks();
  },
  
  deleteTask: async (id) => {
    await deleteTasks([id]);
    await get().fetchTasks();
  },
  
  clearCompleted: async () => {
    await clearCompletedTasks();
    await get().fetchTasks();
  },
  
  retryTask: async (id) => {
    await updateTask(id, { status: 'pending', progress: 0, errorMessage: undefined });
    await get().fetchTasks();
  }
}));
