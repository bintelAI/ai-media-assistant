import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '智联AI',
    version: '1.0.0',
    description: '智联AI采集助手 - 小红书、抖音、快手数据采集与导出工具', 
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
  runner: {
    chromiumArgs: ['--remote-debugging-port=9222']
  },
  dev: {
    serverPort: 3000
  },
  vite: () => ({
    build: {
      sourcemap: true,
    },
    server: {
      port: 3000,
      hmr: false
    }
  })
});
