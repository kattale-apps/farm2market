import { test } from "node:test";
import assert from "node:assert/strict";
import { exifTimeToIso, parseExifLocationTime } from "../app/utils/exif";

type Ifd = { tag: number; type: number; count: number; data: number[] }[];

/** Builds a minimal little-endian EXIF JPEG with GPS and DateTimeOriginal. */
function jpegWithExif(opts: { latRef: string; lat: [number, number, number]; lngRef: string; lng: [number, number, number]; when: string; zone?: string }): ArrayBuffer {
  const tiff: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  const rational = (n: number) => [...u32(Math.round(n * 1000)), ...u32(1000)];
  const text = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);

  // Lay out IFD0 at 8, then the EXIF IFD, the GPS IFD, and their data blocks.
  const exifEntries: Ifd = [{ tag: 0x9003, type: 2, count: opts.when.length + 1, data: text(opts.when) }];
  if (opts.zone) exifEntries.push({ tag: 0x9011, type: 2, count: opts.zone.length + 1, data: text(opts.zone) });
  const gpsEntries: Ifd = [
    { tag: 0x0001, type: 2, count: 2, data: text(opts.latRef) },
    { tag: 0x0002, type: 5, count: 3, data: opts.lat.flatMap(rational) },
    { tag: 0x0003, type: 2, count: 2, data: text(opts.lngRef) },
    { tag: 0x0004, type: 5, count: 3, data: opts.lng.flatMap(rational) },
  ];
  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(2);
  const gpsAt = exifAt + ifdSize(exifEntries.length);
  let dataAt = gpsAt + ifdSize(gpsEntries.length);

  const writeIfd = (entries: Ifd) => {
    const out = [...u16(entries.length)];
    const blobs: number[] = [];
    for (const e of entries) {
      out.push(...u16(e.tag), ...u16(e.type), ...u32(e.count));
      if (e.data.length <= 4) out.push(...e.data, ...Array(4 - e.data.length).fill(0));
      else {
        out.push(...u32(dataAt));
        blobs.push(...e.data);
        dataAt += e.data.length;
      }
    }
    out.push(...u32(0));
    return { out, blobs };
  };
  tiff.push(0x49, 0x49, ...u16(42), ...u32(ifd0At));
  tiff.push(...u16(2), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifAt), ...u16(0x8825), ...u16(4), ...u32(1), ...u32(gpsAt), ...u32(0));
  const exif = writeIfd(exifEntries);
  const gps = writeIfd(gpsEntries);
  tiff.push(...exif.out, ...gps.out, ...exif.blobs, ...gps.blobs);

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const bytes = [0xff, 0xd8, 0xff, 0xe1, ((app1.length + 2) >> 8) & 0xff, (app1.length + 2) & 0xff, ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

test("reads GPS and capture time from a gallery photo's EXIF", () => {
  const r = parseExifLocationTime(jpegWithExif({ latRef: "N", lat: [0, 20, 30], lngRef: "E", lng: [32, 35, 0], when: "2026:09:27 14:05:09" }));
  assert.ok(r.lat !== null && Math.abs(r.lat - (20 / 60 + 30 / 3600)) < 1e-6);
  assert.ok(r.lng !== null && Math.abs(r.lng - (32 + 35 / 60)) < 1e-6);
  // No zone in the file: read as Uganda time, 14:05 EAT = 11:05 UTC.
  assert.equal(r.capturedAt, "2026-09-27T11:05:09.000Z");
});

test("southern and western references give negative coordinates; an explicit zone wins", () => {
  const r = parseExifLocationTime(jpegWithExif({ latRef: "S", lat: [1, 30, 0], lngRef: "W", lng: [10, 0, 0], when: "2026:01:02 08:00:00", zone: "+00:00" }));
  assert.equal(r.lat, -1.5);
  assert.equal(r.lng, -10);
  assert.equal(r.capturedAt, "2026-01-02T08:00:00.000Z");
});

test("files without EXIF give no location or time", () => {
  assert.deepEqual(parseExifLocationTime(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer), { lat: null, lng: null, capturedAt: null });
  assert.deepEqual(parseExifLocationTime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), { lat: null, lng: null, capturedAt: null });
});

test("EXIF time parsing rejects malformed values", () => {
  assert.equal(exifTimeToIso("not a date", null), null);
  assert.equal(exifTimeToIso("0000:00:00 00:00:00", null), null);
});
