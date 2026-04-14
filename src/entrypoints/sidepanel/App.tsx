import { useUIStore } from '@/shared/store';
import Navigation from './components/Navigation';
import Overview from './pages/Overview';
import DataPage from './pages/DataPage';
import TasksCenter from './pages/TasksCenter';
import DownloadsCenter from './pages/DownloadsCenter';
import Settings from './pages/Settings';
import UrlBatchCollect from './pages/UrlBatchCollect';
import ExportModal from './components/ExportModal';
import DetailDrawer from './components/DetailDrawer';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import Toast from './components/Toast';

export default function App() {
  const { currentPage, exportModalOpen, detailDrawerOpen, taskDetailOpen, toastMessage } = useUIStore();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Navigation />
      
      <main className="flex-1 overflow-hidden">
        {currentPage === 'overview' && <Overview />}
        {currentPage === 'data' && <DataPage />}
        {currentPage === 'tasks' && <TasksCenter />}
        {currentPage === 'downloads' && <DownloadsCenter />}
        {currentPage === 'settings' && <Settings />}
        {currentPage === 'batchCollect' && <UrlBatchCollect />}
      </main>
      
      {exportModalOpen && <ExportModal />}
      {detailDrawerOpen && <DetailDrawer />}
      {taskDetailOpen && <TaskDetailDrawer />}
      {toastMessage && <Toast />}
    </div>
  );
}
