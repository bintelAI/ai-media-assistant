import type { ExportTemplate } from '../types/export';
import type { ExportTarget } from '../types';
import { getDB } from './index';
import { generateId } from '../utils/helpers';

export interface TemplateQueryOptions {
  targetType?: ExportTarget;
  limit?: number;
  offset?: number;
}

export async function addTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = await getDB();
  
  const now = new Date().toISOString();
  
  const entity: ExportTemplate = {
    ...template,
    id: generateId('template'),
    createdAt: now,
    updatedAt: now
  };
  
  await db.add('templates', entity);
  return entity.id;
}

export async function updateTemplate(id: string, updates: Partial<ExportTemplate>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('templates', id);
  
  if (!existing) {
    throw new Error(`Template not found: ${id}`);
  }
  
  const updated: ExportTemplate = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await db.put('templates', updated);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('templates', id);
}

export async function getTemplate(id: string): Promise<ExportTemplate | undefined> {
  const db = await getDB();
  return db.get('templates', id);
}

export async function queryTemplates(options: TemplateQueryOptions = {}): Promise<ExportTemplate[]> {
  const db = await getDB();
  let templates: ExportTemplate[];
  
  if (options.targetType) {
    templates = await db.getAllFromIndex('templates', 'by-targetType', options.targetType);
  } else {
    templates = await db.getAll('templates');
  }
  
  templates.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  if (options.offset !== undefined) {
    templates = templates.slice(options.offset);
  }
  
  if (options.limit !== undefined) {
    templates = templates.slice(0, options.limit);
  }
  
  return templates;
}

export async function clearTemplates(): Promise<void> {
  const db = await getDB();
  await db.clear('templates');
}
