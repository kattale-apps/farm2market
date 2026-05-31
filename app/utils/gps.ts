import { Capacitor, registerPlugin } from "@capacitor/core";

const Geolocation = registerPlugin<any>("Geolocation");

export interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const currentPerm = await Geolocation.checkPermissions();
    const granted = currentPerm.location === "granted" || currentPerm.coarseLocation === "granted";
    if (granted) return true;
    const requested = await Geolocation.requestPermissions();
    return requested.location === "granted" || requested.coarseLocation === "granted";
  }

  if (!navigator?.geolocation) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        () => reject(),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentLocation(): Promise<GpsPosition | null> {
  if (Capacitor.isNativePlatform()) {
    const permissionGranted = await requestLocationPermission();
    if (!permissionGranted) {
      throw new Error("Location permission denied");
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? 0,
    };
  }

  if (!navigator?.geolocation) return null;
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 0,
  };
}
