import test from "node:test";
import assert from "node:assert/strict";

import { fromStoredUgandaTime, inUgandaTime } from "../app/utils/timeUtils";
import { ugandaTimeToInstant } from "../convex/utils";

// 2026-09-23 09:00 UTC is 12:00 in Kampala.
const realInstant = Date.UTC(2026, 8, 23, 9, 0, 0);
const storedWithGetUgandaTime = realInstant + 3 * 60 * 60 * 1000;

const hourIn = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-GB", inUgandaTime({ hour: "2-digit", minute: "2-digit" }));

test("a real instant displays in Kampala time", () => {
  assert.equal(hourIn(realInstant), "12:00");
});

test("a getUgandaTime() value displays the same wall clock once converted", () => {
  assert.equal(hourIn(fromStoredUgandaTime(storedWithGetUgandaTime)), "12:00");
  // Without converting it would read three hours late.
  assert.equal(hourIn(storedWithGetUgandaTime), "15:00");
});

test("the backend conversion matches the frontend one", () => {
  assert.equal(ugandaTimeToInstant(storedWithGetUgandaTime), realInstant);
  assert.equal(ugandaTimeToInstant(undefined), undefined);
});
