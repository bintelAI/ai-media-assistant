import type { TaskEntity } from '../types/entities';
import type { TaskType, TaskStatus } from '../types';
import { getDB } from './index';
import { generateId } from '../utils/helpers';

export interface TaskQueryOptions {
  status?: TaskStatus;
  taskType?: TaskType;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export async function addTask(task: Omit<TaskEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = await getDB();
  
  const now = new Date().toISOString();
  
  const entity: TaskEntity = {
    ...task,
    id: generateId('task'),
    createdAt: now,
    updatedAt: now
  };
  
  await db.add('tasks', entity);
  return entity.id;
}

export async function updateTask(id: string, updates: Partial<TaskEntity>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('tasks', id);
  
  if (!existing) {
    throw new Error(`Task not found: ${id}`);
  }
  
  const updated: TaskEntity = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  if (updates.status === 'success' || updates.status === 'failed' || updates.status === 'canceled') {
    updated.finishedAt = new Date().toISOString();
  }
  
  await db.put('tasks', updated);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', id);
}

export async function deleteTasks(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  
  await Promise.all(ids.map(id => tx.store.delete(id)));
  
  await tx.done;
}

export async function getTask(id: string): Promise<TaskEntity | undefined> {
  const db = await getDB();
  return db.get('tasks', id);
}

export async function queryTasks(options: TaskQueryOptions = {}): Promise<TaskEntity[]> {
  const db = await getDB();
  let tasks: TaskEntity[];
  
  if (options.status) {
    tasks = await db.getAllFromIndex('tasks', 'by-status', options.status);
  } else if (options.taskType) {
    tasks = await db.getAllFromIndex('tasks', 'by-taskType', options.taskType);
  } else {
    tasks = await db.getAll('tasks');
  }
  
  const orderBy = options.orderBy || 'createdAt';
  const orderDirection = options.orderDirection || 'desc';
  
  tasks.sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return orderDirection === 'desc' ? -comparison : comparison;
  });
  
  if (options.offset !== undefined) {
    tasks = tasks.slice(options.offset);
  }
  
  if (options.limit !== undefined) {
    tasks = tasks.slice(0, options.limit);
  }
  
  return tasks;
}

export async function countTasks(options: Omit<TaskQueryOptions, 'limit' | 'offset' | 'orderBy' | 'orderDirection'> = {}): Promise<number> {
  const tasks = await queryTasks(options);
  return tasks.length;
}

export async function clearCompletedTasks(): Promise<void> {
  const db = await getDB();
  const completedTasks = await db.getAllFromIndex('tasks', 'by-status', 'success');
  const failedTasks = await db.getAllFromIndex('tasks', 'by-status', 'failed');
  const canceledTasks = await db.getAllFromIndex('tasks', 'by-status', 'canceled');
  
  const ids = [...completedTasks, ...failedTasks, ...canceledTasks].map(t => t.id);
  
  if (ids.length > 0) {
    await deleteTasks(ids);
  }
}

export async function clearTasks(): Promise<void> {
  const db = await getDB();
  await db.clear('tasks');
}
