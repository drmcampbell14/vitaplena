/// <reference types="@capacitor/local-notifications" />
/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/status-bar" />
import type { CapacitorConfig } from "@capacitor/cli";

/* Vita Plena — the native shells.
   The same built site (dist/) runs inside an iOS and an Android app. Nothing
   here changes how the web app behaves; src/lib/native.js is where the app
   notices it is inside a shell. `npm run native` rebuilds and copies. */
const config: CapacitorConfig = {
  appId: "com.vitaplena.app",
  appName: "Vita Plena",
  webDir: "dist",
  // The app's own background, shown behind the web view before it paints.
  backgroundColor: "#FAFBFD",
  ios: {
    // Never let the web view scroll under the status bar; the app draws its own header.
    contentInset: "never",
    scrollEnabled: true
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    SplashScreen: {
      // The launch image stays until main.js hides it, so there is no white flash
      // between the splash and the first paint of the app.
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: "#16386A",
      splashFullScreen: true,
      splashImmersive: true,
      androidScaleType: "CENTER_CROP"
    },
    StatusBar: {
      // Light text over the Marian header on both platforms.
      style: "DARK",
      overlaysWebView: true,
      backgroundColor: "#16386A"
    },
    LocalNotifications: {
      smallIcon: "ic_stat_bell",
      iconColor: "#1F4E8C",
      presentationOptions: ["sound", "banner", "list"]
    }
  }
};

export default config;
