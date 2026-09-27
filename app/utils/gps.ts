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

/**
 * Follows the device location as it changes. Returns a function that stops
 * watching. Errors go to onError; the watch keeps running where it can.
 */
export function watchLocation(onFix: (pos: GpsPosition & { at: number }) => void, onError: (message: string) => void): () => void {
  let stopped = false;
  let stop: () => void = () => {};
  const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

  if (Capacitor.isNativePlatform()) {
    requestLocationPermission()
      .then(async (granted) => {
        if (!granted) return onError("Location permission denied");
        const id: string = await Geolocation.watchPosition(options, (pos: any, err: any) => {
          if (stopped) return;
          if (err || !pos) return onError(err?.message ?? "Could not get your location");
          onFix({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 0, at: Date.now() });
        });
        if (stopped) Geolocation.clearWatch({ id });
        else stop = () => Geolocation.clearWatch({ id });
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Could not get your location"));
  } else if (typeof navigator !== "undefined" && navigator.geolocation) {
    const id = navigator.geolocation.watchPosition(
      (pos) => !stopped && onFix({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 0, at: Date.now() }),
      (err) => !stopped && onError(err.code === err.PERMISSION_DENIED ? "Location permission denied" : "Could not get your location"),
      options
    );
    stop = () => navigator.geolocation.clearWatch(id);
  } else {
    onError("This device cannot share its location");
  }

  return () => {
    stopped = true;
    stop();
  };
}
