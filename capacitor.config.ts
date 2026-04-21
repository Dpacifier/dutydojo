import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.switchitglobal.dutydojo',
  appName: 'DutyDojo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#6366f1',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#6366f1',
    },
  },
};

export default config;
