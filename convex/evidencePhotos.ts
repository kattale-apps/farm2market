/**
 * A proof photo in the trace journey (CLAUDESCOPE Rule 9). Camera photos
 * carry the live GPS position and time; gallery photos carry what their EXIF
 * data says; when a gallery photo has neither, the user types them in and the
 * photo is flagged so the Storage and Transport Officer or reviewer can tell.
 *
 * The provenance fields are optional so evidence saved before them stays valid.
 */

import { v, Infer } from "convex/values";

export const evidencePhotoFields = {
  storageId: v.id("_storage"),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  accuracy: v.optional(v.number()),
  capturedAt: v.string(), // ISO 8601
  source: v.optional(v.union(v.literal("camera"), v.literal("gallery"))),
  // live = phone GPS at capture; exif = read from the photo file; manual = typed in
  locationSource: v.optional(v.union(v.literal("live"), v.literal("exif"), v.literal("manual"), v.literal("none"))),
  manualEntry: v.optional(v.boolean()),
};

export const evidencePhotoValidator = v.object(evidencePhotoFields);
export type EvidencePhoto = Infer<typeof evidencePhotoValidator>;

function validLat(n: number | undefined) {
  return n === undefined || (Number.isFinite(n) && n >= -90 && n <= 90);
}
function validLng(n: number | undefined) {
  return n === undefined || (Number.isFinite(n) && n >= -180 && n <= 180);
}

/** Checks a set of evidence photos; `max` bounds how many one submission may carry. */
export function assertEvidencePhotos(photos: EvidencePhoto[], max: number, min = 1) {
  if (photos.length < min || photos.length > max) {
    throw new Error(min === max ? `Add ${max} photo${max === 1 ? "" : "s"}` : `Add between ${min} and ${max} photos`);
  }
  for (const p of photos) {
    if (!validLat(p.lat) || !validLng(p.lng)) throw new Error("Photo GPS is out of range");
    if ((p.lat === undefined) !== (p.lng === undefined)) throw new Error("A photo needs both latitude and longitude");
    if (Number.isNaN(Date.parse(p.capturedAt))) throw new Error("A photo has no valid date and time");
    // A hand-entered location must still be a location.
    if (p.manualEntry && (p.lat === undefined || p.lng === undefined)) {
      throw new Error("Enter the location where the photo was taken");
    }
  }
}

/** True when any photo's location or time was typed in rather than recorded. */
export function hasManualPhoto(photos: { manualEntry?: boolean }[]): boolean {
  return photos.some((p) => p.manualEntry === true);
}
