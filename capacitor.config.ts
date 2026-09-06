import { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? "https://dev.farm2marketuganda.com";

const config: CapacitorConfig = {
  appId: "com.farm2marketuganda.app",
  appName: "FarmCoin",
  webDir: "out",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
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
