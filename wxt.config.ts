import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '智联采集',
    version: '1.0.0',
    description: '社媒数据采集助手 - 小红书、抖音、快手数据采集与导出工具',
    permissions: [
      'activeTab',
      'downloads',
      'scripting',
      'storage',
      'sidePanel',
      'tabs',
      'alarms'
    ],
    host_permissions: [
      'https://www.xiaohongshu.com/*',
      'https://pgy.xiaohongshu.com/*',
      'https://www.douyin.com/*',
      'https://star.toutiao.com/*',
      'https://www.kuaishou.com/*',
      'https://www.tiktok.com/*'
    ],
    side_panel: {
      default_path: 'sidepanel.html'
    },
    action: {},
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Alt+C'
        }
      }
    }
  },
  srcDir: 'src',
  outDir: 'dist',
  dev: {
    serverPort: 3000
  },
  vite: () => ({
    server: {
      port: 3000,
      hmr: false
    }
  })
});
