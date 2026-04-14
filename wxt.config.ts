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
      'alarms',
      'cookies',
      'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess'
    ],
    host_permissions: [
      'https://www.xiaohongshu.com/*',
      'https://pgy.xiaohongshu.com/*',
      'https://www.douyin.com/*',
      'https://star.toutiao.com/*',
      'https://www.kuaishou.com/*',
      'https://www.tiktok.com/*',
      'https://fe-static.xhscdn.com/*'
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
    },
    declarative_net_request: {
      rule_resources: [
        {
          id: 'xiaohongshu',
          enabled: true,
          path: 'xiaohongshu/rule.json'
        }
      ]
    },
    web_accessible_resources: [
      {
        resources: ['xiaohongshu/vendor-dynamic.js'],
        matches: ['*://www.xiaohongshu.com/*']
      }
    ]
  },
  srcDir: 'src',
  outDir: 'dist',
  dev: {
    serverPort: 3000
  },
  webExt: {
    startUrl: undefined
  },
  vite: () => ({
    build: {
      sourcemap: false,
    },
    server: {
      port: 3000,
      hmr: false
    }
  })
});
