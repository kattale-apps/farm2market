import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.farm2marketuganda.app",
  appName: "FarmCoin",
  webDir: "out", // Will be ignored when using server.url
  server: {
    url: "https://farm2market-git-develop-kattale-apps.vercel.app", // Your Vercel deployment URL
    cleartext: false, // HTTPS only
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
