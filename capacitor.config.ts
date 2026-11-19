import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.orgista.openpanel',
  appName: 'OpenPanel',
  webDir: 'dist',
  // Matches the launch window and splash fill; the WebView default is white,
  // which flashed between the system splash and the first page paint.
  backgroundColor: '#050607',
  android: {
    allowMixedContent: false,
  },
}

export default config
