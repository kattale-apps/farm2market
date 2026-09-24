// app/utils/dateUtils.ts

import { inUgandaTime } from "./timeUtils";

export const getUgandaTime = () => {
  // Returns current timestamp. In a real app, you might want to handle timezone offsets explicitly
  // if the server is not in the target timezone, but for client-side display, standard Date works.
  return Date.now();
};

// These take a real instant (not a getUgandaTime() value) and show it in
// Uganda time whatever the viewer's device timezone is.
export const formatUgandaDate = (timestamp: number) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("en-UG", inUgandaTime());
};

export const formatUgandaDateTime = (timestamp: number) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("en-UG", inUgandaTime());
};
