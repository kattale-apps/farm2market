import assert from "node:assert/strict";
import test from "node:test";

import { directoryEntry, servedDistricts, servesDistrict } from "../convex/transportShared";

const today = "2026-10-27";
const boda = { vehicleType: "motorcycle", capacityTonnes: 0.2 };
const vehicle = (status: string, insuranceExpiry = "2027-01-01") => ({ vehicleType: "lorry", capacityTonnes: 10, status, insuranceExpiry });
const driver = (status: string, licenceExpiry = "2027-01-01") => ({ status, licenceExpiry });

test("a new boda boda transporter shows in Book Transport at once, as not verified yet", () => {
  const entry = directoryEntry({ available: undefined, vehicles: [], drivers: [], onboardingVehicle: boda, today });
  assert.equal(entry.shown, true, "taking bookings until they switch it off");
  assert.equal(entry.verified, false);
  assert.deepEqual(entry.vehicles, [boda], "the vehicle from onboarding stands in until they send one");
});

test("switching bookings off hides a transporter", () => {
  assert.equal(directoryEntry({ available: false, vehicles: [vehicle("verified")], drivers: [driver("verified")], onboardingVehicle: boda, today }).shown, false);
});

test("verified needs a checked vehicle with valid insurance and a checked driver with a valid licence", () => {
  const ok = directoryEntry({ available: true, vehicles: [vehicle("verified"), vehicle("pending")], drivers: [driver("verified")], onboardingVehicle: boda, today });
  assert.equal(ok.verified, true);
  assert.equal(ok.vehicles.length, 1, "a verified transporter shows only checked vehicles");
  assert.equal(directoryEntry({ available: true, vehicles: [vehicle("verified")], drivers: [driver("pending")], onboardingVehicle: boda, today }).verified, false);
  assert.equal(directoryEntry({ available: true, vehicles: [vehicle("verified", "2026-10-01")], drivers: [driver("verified")], onboardingVehicle: boda, today }).verified, false, "expired insurance");
  assert.equal(directoryEntry({ available: true, vehicles: [vehicle("verified")], drivers: [driver("verified", "2026-01-01")], onboardingVehicle: boda, today }).verified, false, "expired licence");
});

test("a transporter not verified yet shows the vehicles they sent, never rejected ones", () => {
  const entry = directoryEntry({ available: true, vehicles: [vehicle("pending"), vehicle("rejected")], drivers: [], onboardingVehicle: boda, today });
  assert.equal(entry.vehicles.length, 1);
  assert.equal(entry.vehicles[0].vehicleType, "lorry");
});

test("districts: the ones chosen, or the home district; typing part of a name finds it", () => {
  assert.deepEqual(servedDistricts(["Masaka", "Kampala"], "Wakiso"), ["Masaka", "Kampala"]);
  assert.deepEqual(servedDistricts([], "Wakiso"), ["Wakiso"]);
  assert.deepEqual(servedDistricts(undefined, null), []);
  assert.equal(servesDistrict(["Kampala"], "kampala"), true);
  assert.equal(servesDistrict(["Kampala"], " Kamp "), true);
  assert.equal(servesDistrict(["Masaka"], "kampala"), false);
  assert.equal(servesDistrict([], ""), true, "nothing typed shows everyone");
});
