/**
 * Transport directory - plain shared rules (no Convex server imports), used by
 * convex/transport.ts and the tests.
 *
 * Every active transporter shows in Book Transport while they take bookings,
 * so anyone with a boda boda can start straight away. A transporter whose
 * vehicle (with valid insurance) and driver (with a valid licence) a Storage
 * and Transport Officer or super admin has checked shows as verified, ahead
 * of the others; the rest show as "not verified yet" so the person booking
 * knows.
 */

type FleetVehicle = { vehicleType: string; capacityTonnes: number; status: string; insuranceExpiry: string };
type FleetDriver = { status: string; licenceExpiry: string };
export type DirectoryVehicle = { vehicleType: string; capacityTonnes: number };

/**
 * How a transporter shows in the directory. Taking bookings is on unless
 * they switched it off. A verified transporter shows their verified
 * vehicles; others show the vehicles they sent (not rejected ones), or the
 * vehicle they gave at onboarding.
 */
export function directoryEntry(input: {
  available: boolean | undefined;
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  onboardingVehicle: DirectoryVehicle | null;
  today: string;
}): { shown: boolean; verified: boolean; vehicles: DirectoryVehicle[] } {
  const verifiedVehicles = input.vehicles.filter((x) => x.status === "verified" && x.insuranceExpiry >= input.today);
  const verifiedDriver = input.drivers.some((x) => x.status === "verified" && x.licenceExpiry >= input.today);
  const verified = verifiedVehicles.length > 0 && verifiedDriver;
  const sent = verified ? verifiedVehicles : input.vehicles.filter((x) => x.status !== "rejected");
  const vehicles = sent.length > 0 ? sent : input.onboardingVehicle ? [input.onboardingVehicle] : [];
  return {
    shown: input.available !== false,
    verified,
    vehicles: vehicles.map((x) => ({ vehicleType: x.vehicleType, capacityTonnes: x.capacityTonnes })),
  };
}

/** The districts a transporter serves: the ones they chose, or their home district until they choose. */
export function servedDistricts(chosen: string[] | undefined, home: string | null): string[] {
  if (chosen && chosen.length > 0) return chosen;
  return home ? [home] : [];
}

/** Whether a typed district ("kamp", "Kampala") matches one the transporter serves; nothing typed matches all. */
export function servesDistrict(served: string[], typed: string): boolean {
  const want = typed.trim().toLowerCase();
  return !want || served.some((d) => d.toLowerCase().includes(want));
}
