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
      'https://lf-douyin-pc-web.douyinstatic.com/*',
      'https://star.toutiao.com/*',
      'https://www.kuaishou.com/*',
      'https://www.tiktok.com/*',
      'https://fe-static.xhscdn.com/*',
      'https://dimens.bintelai.com/*'
    ],
    side_panel: {
      default_path: 'sidepanel.html'
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png'
    },
    action: {
      default_title: '智联AI',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        96: 'icon/96.png',
        128: 'icon/128.png'
      }
    },
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
        },
        {
          id: 'douyin',
          enabled: true,
          path: 'douyin/rule.json'
        }
      ]
    },
    web_accessible_resources: [
      {
        resources: ['xiaohongshu/vendor-dynamic.js'],
        matches: ['*://www.xiaohongshu.com/*']
      },
      {
        resources: ['douyin/client-entry.js', 'douyin/main-interceptor.js'],
        matches: ['*://www.douyin.com/*']
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
