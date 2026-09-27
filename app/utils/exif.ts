/**
 * Reads where and when a photo was taken from its EXIF data (JPEG only).
 *
 * Trace-journey evidence (CLAUDESCOPE Rule 9) takes a gallery photo's GPS
 * position and capture time from the file itself rather than from the phone
 * at the moment of upload, which would record the wrong place and time.
 */

export type ExifLocationTime = {
  lat: number | null;
  lng: number | null;
  /** ISO 8601 instant, or null when the photo carries no capture time. */
  capturedAt: string | null;
};

const EMPTY: ExifLocationTime = { lat: null, lng: null, capturedAt: null };

// EXIF times have no zone unless OffsetTimeOriginal is set; phones in the app's
// market record local time, which is Uganda time (UTC+3).
const DEFAULT_OFFSET_MINUTES = 180;

export async function readExifLocationTime(file: Blob): Promise<ExifLocationTime> {
  try {
    // EXIF sits in the APP1 segment near the start of the file.
    const buffer = await file.slice(0, 256 * 1024).arrayBuffer();
    return parseExifLocationTime(buffer);
  } catch {
    return EMPTY;
  }
}

export function parseExifLocationTime(buffer: ArrayBuffer): ExifLocationTime {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return EMPTY; // not a JPEG
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) return EMPTY;
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      return parseTiff(view, offset + 10, Math.min(view.byteLength, offset + 2 + size));
    }
    if (marker === 0xffda) return EMPTY; // image data starts; no EXIF before it
    offset += 2 + size;
  }
  return EMPTY;
}

type Entry = { tag: number; type: number; count: number; valueOffset: number };

function parseTiff(view: DataView, start: number, end: number): ExifLocationTime {
  if (start + 8 > end) return EMPTY;
  const little = view.getUint16(start) === 0x4949;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);
  if (u16(start + 2) !== 42) return EMPTY;

  const readIfd = (ifdOffset: number): Map<number, Entry> => {
    const entries = new Map<number, Entry>();
    const at = start + ifdOffset;
    if (ifdOffset <= 0 || at + 2 > end) return entries;
    const count = u16(at);
    for (let i = 0; i < count; i++) {
      const e = at + 2 + i * 12;
      if (e + 12 > end) break;
      entries.set(u16(e), { tag: u16(e), type: u16(e + 2), count: u32(e + 4), valueOffset: e + 8 });
    }
    return entries;
  };
  // Where an entry's data lives: inline when it fits in 4 bytes, else at an offset.
  const dataAt = (entry: Entry, bytes: number) => (bytes <= 4 ? entry.valueOffset : start + u32(entry.valueOffset));
  const ascii = (entry: Entry | undefined): string | null => {
    if (!entry || entry.type !== 2) return null;
    const at = dataAt(entry, entry.count);
    if (at + entry.count > end) return null;
    let s = "";
    for (let i = 0; i < entry.count; i++) {
      const c = view.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const rationals = (entry: Entry | undefined): number[] | null => {
    if (!entry || entry.type !== 5) return null;
    const at = dataAt(entry, entry.count * 8);
    if (at + entry.count * 8 > end) return null;
    const out: number[] = [];
    for (let i = 0; i < entry.count; i++) {
      const den = u32(at + i * 8 + 4);
      out.push(den === 0 ? NaN : u32(at + i * 8) / den);
    }
    return out;
  };

  const ifd0 = readIfd(u32(start + 4));
  const exifPointer = ifd0.get(0x8769);
  const gpsPointer = ifd0.get(0x8825);
  const exifIfd = exifPointer ? readIfd(u32(exifPointer.valueOffset)) : new Map<number, Entry>();
  const gpsIfd = gpsPointer ? readIfd(u32(gpsPointer.valueOffset)) : new Map<number, Entry>();

  const toDegrees = (dms: number[] | null, ref: string | null, negative: string): number | null => {
    if (!dms || dms.length < 3 || dms.some((n) => !Number.isFinite(n))) return null;
    const deg = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return ref?.toUpperCase().startsWith(negative) ? -deg : deg;
  };
  let lat = toDegrees(rationals(gpsIfd.get(0x0002)), ascii(gpsIfd.get(0x0001)), "S");
  let lng = toDegrees(rationals(gpsIfd.get(0x0004)), ascii(gpsIfd.get(0x0003)), "W");
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    lat = null;
    lng = null;
  }

  const when = ascii(exifIfd.get(0x9003)) ?? ascii(exifIfd.get(0x9004)) ?? ascii(ifd0.get(0x0132));
  const zone = ascii(exifIfd.get(0x9011));
  return { lat, lng, capturedAt: exifTimeToIso(when, zone) };
}

/** "2026:09:27 14:05:09" (+ optional "+03:00") to an ISO instant. */
export function exifTimeToIso(value: string | null, zone: string | null): string | null {
  const m = value?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  let offsetMinutes = DEFAULT_OFFSET_MINUTES;
  const z = zone?.match(/^([+-])(\d{2}):(\d{2})$/);
  if (z) offsetMinutes = (z[1] === "-" ? -1 : 1) * (Number(z[2]) * 60 + Number(z[3]));
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - offsetMinutes * 60_000;
  if (!Number.isFinite(utc) || +m[1] < 1990) return null;
  return new Date(utc).toISOString();
}
