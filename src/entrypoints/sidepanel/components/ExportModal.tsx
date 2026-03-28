import { useState } from 'react';
import { useUIStore, usePostsStore, useAuthorsStore, useCommentsStore, useSettingsStore } from '@/shared/store';
import { X, Download, Save } from 'lucide-react';
import { formatDate, downloadBlob } from '@/shared/utils/helpers';
import { addTemplate, queryTemplates } from '@/shared/db/templates';
import { addTask } from '@/shared/db/tasks';
import type { ExportFieldConfig, ExportTemplate } from '@/shared/types/export';
import { POST_EXPORT_FIELDS, AUTHOR_EXPORT_FIELDS, COMMENT_EXPORT_FIELDS } from '@/shared/types/export';
import * as XLSX from 'xlsx';

export default function ExportModal() {
  const { exportTarget, closeExportModal } = useUIStore();
  const { defaultExportFormat } = useSettingsStore();
  const { getExportData: getPostsData } = usePostsStore();
  const { getExportData: getAuthorsData } = useAuthorsStore();
  const { getExportData: getCommentsData } = useCommentsStore();
  
  const [scope, setScope] = useState<'all' | 'filtered' | 'selected'>('selected');
  const [format, setFormat] = useState<'csv' | 'excel' | 'json'>(defaultExportFormat);
  const [fileName, setFileName] = useState('');
  const [fields, setFields] = useState<ExportFieldConfig[]>([]);
  const [loading, setLoading] = useState(false);
  
  useState(() => {
    switch (exportTarget) {
      case 'posts':
        setFields(POST_EXPORT_FIELDS);
        setFileName(`posts_${formatDate(new Date(), 'yyyyMMdd')}`);
        break;
      case 'authors':
        setFields(AUTHOR_EXPORT_FIELDS);
        setFileName(`authors_${formatDate(new Date(), 'yyyyMMdd')}`);
        break;
      case 'comments':
        setFields(COMMENT_EXPORT_FIELDS);
        setFileName(`comments_${formatDate(new Date(), 'yyyyMMdd')}`);
        break;
    }
  });

  const handleToggleField = (key: string) => {
    setFields(fields.map(f => 
      f.key === key ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const handleFieldLabelChange = (key: string, customLabel: string) => {
    setFields(fields.map(f => 
      f.key === key ? { ...f, customLabel } : f
    ));
  };

  const handleExport = async () => {
    if (fields.filter(f => f.enabled).length === 0) {
      alert('请至少选择一个字段');
      return;
    }

    setLoading(true);
    
    try {
      let data: Record<string, unknown>[] = [];
      
      switch (exportTarget) {
        case 'posts':
          data = await getPostsData(scope) as Record<string, unknown>[];
          break;
        case 'authors':
          data = await getAuthorsData(scope) as Record<string, unknown>[];
          break;
        case 'comments':
          data = await getCommentsData(scope) as Record<string, unknown>[];
          break;
      }

      if (data.length === 0) {
        alert('没有可导出的数据');
        setLoading(false);
        return;
      }

      const enabledFields = fields.filter(f => f.enabled).sort((a, b) => a.order - b.order);
      
      const exportData = data.map(item => {
        const row: Record<string, unknown> = {};
        enabledFields.forEach(field => {
          const label = field.customLabel || field.label;
          let value = item[field.key];
          
          if (Array.isArray(value)) {
            value = value.join('; ');
          }
          if (value instanceof Date) {
            value = formatDate(value.toISOString());
          }
          
          row[label] = value ?? '';
        });
        return row;
      });

      let blob: Blob;
      let extension: string;

      switch (format) {
        case 'excel':
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
          const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
          blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          extension = 'xlsx';
          break;
          
        case 'csv':
          const csvWorksheet = XLSX.utils.json_to_sheet(exportData);
          const csv = XLSX.utils.sheet_to_csv(csvWorksheet);
          blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
          extension = 'csv';
          break;
          
        case 'json':
          const json = JSON.stringify(exportData, null, 2);
          blob = new Blob([json], { type: 'application/json;charset=utf-8' });
          extension = 'json';
          break;
      }

      downloadBlob(blob, `${fileName}.${extension}`);
      
      await addTask({
        taskType: 'export_data',
        title: `导出${exportTarget === 'posts' ? '帖子' : exportTarget === 'authors' ? '作者' : '评论'}数据`,
        status: 'success',
        meta: { count: data.length, format }
      });
      
      closeExportModal();
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    const name = prompt('请输入模板名称');
    if (!name) return;
    
    await addTemplate({
      name,
      targetType: exportTarget!,
      format,
      fields,
      fileNameRule: fileName,
      autoAddDateSuffix: true
    });
    
    alert('模板已保存');
  };

  const targetLabel = exportTarget === 'posts' ? '帖子' : 
                      exportTarget === 'authors' ? '作者' : '评论';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[90%] max-w-lg max-h-[90%] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">导出{targetLabel}数据</h3>
          <button onClick={closeExportModal} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">导出范围</label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: '全部数据' },
                { value: 'filtered', label: '筛选结果' },
                { value: 'selected', label: '选中数据' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value as 'all' | 'filtered' | 'selected')}
                  className={`px-3 py-1.5 text-sm rounded-md ${
                    scope === opt.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">导出格式</label>
            <div className="flex gap-2">
              {[
                { value: 'excel', label: 'Excel (.xlsx)' },
                { value: 'csv', label: 'CSV' },
                { value: 'json', label: 'JSON' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value as 'csv' | 'excel' | 'json')}
                  className={`px-3 py-1.5 text-sm rounded-md ${
                    format === opt.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">导出字段</label>
            <div className="border border-gray-200 rounded-md max-h-48 overflow-auto">
              {fields.map(field => (
                <div key={field.key} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={() => handleToggleField(field.key)}
                    className="w-4 h-4 text-primary-500 rounded"
                  />
                  <span className="flex-1 text-sm">{field.label}</span>
                  <input
                    type="text"
                    value={field.customLabel || ''}
                    onChange={(e) => handleFieldLabelChange(field.key, e.target.value)}
                    placeholder={field.label}
                    className="w-24 px-2 py-0.5 text-xs border border-gray-200 rounded"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">文件名</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <button
            onClick={handleSaveTemplate}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            <Save className="w-4 h-4" />
            保存为模板
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={closeExportModal}
              className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex items-center gap-1 px-4 py-1.5 text-sm bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {loading ? '导出中...' : '确认导出'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
