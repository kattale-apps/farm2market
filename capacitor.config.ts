import { CapacitorConfig } from "@capacitor/cli";

// Default to production; native builds override via BuildConfig
const SERVER_URL = typeof window !== 'undefined' 
  ? (window as any).BuildConfig?.SERVER_URL ?? "https://www.farm2marketuganda.com"
  : "https://www.farm2marketuganda.com";

const config: CapacitorConfig = {
  appId: "com.farm2marketuganda.app",
  appName: "FarmCoin",
  webDir: "out",
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    Geolocation: {
      permissions: ["location", "coarseLocation"],
      enableHighAccuracy: true,
    },
  },
};

export default config;
