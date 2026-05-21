import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.match3d.greenhouse',
  appName: 'The Living Blueprint',
  webDir: 'apps/web/dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'match3d.app',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a1628',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0a1628',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    buildOptions: {
      keystorePath: 'android/keystore.jks',
      releaseType: 'APK',
    },
    minWebViewVersion: 87,
    loggingBehavior: 'none',
  },
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
