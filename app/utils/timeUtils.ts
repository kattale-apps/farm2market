/**
 * Time utilities for Uganda timezone (UTC+3)
 * All time displays and calculations should use Uganda time
 */

/**
 * Get current time in Uganda timezone (UTC+3)
 * @returns Timestamp in milliseconds (UTC time + 3 hours)
 */
export function getUgandaTime(): number {
  const ugandaOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  return Date.now() + ugandaOffset;
}

export const UGANDA_TIME_ZONE = "Africa/Kampala";

/**
 * The backend records times two ways. Most modules store getUgandaTime()
 * (the real instant plus 3 hours); others store a real instant (Date.now(),
 * _creationTime, a date picked in the browser). A shifted value must be
 * converted back before display, or it reads 3 hours late.
 */
export function fromStoredUgandaTime(timestamp: number): number {
  return timestamp - 3 * 60 * 60 * 1000;
}

/**
 * toLocale* options that display in Uganda time (UTC+3) whatever timezone
 * the viewer's device is set to. Pass a real instant, converting shifted
 * values with fromStoredUgandaTime first.
 */
export function inUgandaTime(options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormatOptions {
  return { ...options, timeZone: UGANDA_TIME_ZONE };
}

/**
 * Format a timestamp to Uganda timezone string
 * @param timestamp - Timestamp in milliseconds (stored as Uganda time, i.e., UTC+3)
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date/time string in Uganda timezone
 */
export function formatUgandaTime(
  timestamp: number,
  options?: Intl.DateTimeFormatOptions
): string {
  // Timestamps are stored as Uganda time (UTC+3), so we need to convert back to UTC
  // for JavaScript Date to interpret correctly, then format in Uganda timezone
  const ugandaOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  const utcTimestamp = timestamp - ugandaOffset;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Africa/Kampala",
    dateStyle: "short",
    timeStyle: "medium",
    ...options,
  };
  
  return new Date(utcTimestamp).toLocaleString("en-US", defaultOptions);
}

/**
 * Format a timestamp to Uganda date string (date only)
 * @param timestamp - Timestamp in milliseconds (should be Uganda time)
 * @returns Formatted date string in Uganda timezone
 */
export function formatUgandaDate(timestamp: number): string {
  return formatUgandaTime(timestamp, {
    timeZone: "Africa/Kampala",
    dateStyle: "medium",
  });
}

/**
 * Format a timestamp to Uganda time string (time only)
 * @param timestamp - Timestamp in milliseconds (should be Uganda time)
 * @returns Formatted time string in Uganda timezone
 */
export function formatUgandaTimeOnly(timestamp: number): string {
  return formatUgandaTime(timestamp, {
    timeZone: "Africa/Kampala",
    timeStyle: "medium",
  });
}

/**
 * Format a timestamp to a short date/time string in Uganda timezone
 * @param timestamp - Timestamp in milliseconds (should be Uganda time)
 * @returns Short formatted date/time string
 */
export function formatUgandaDateTime(timestamp: number): string {
  return formatUgandaTime(timestamp, {
    timeZone: "Africa/Kampala",
    dateStyle: "short",
    timeStyle: "short",
  });
}
