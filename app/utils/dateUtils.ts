// app/utils/dateUtils.ts

export const getUgandaTime = () => {
  // Returns current timestamp. In a real app, you might want to handle timezone offsets explicitly
  // if the server is not in the target timezone, but for client-side display, standard Date works.
  return Date.now();
};

export const formatUgandaDate = (timestamp: number) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("en-UG");
};

export const formatUgandaDateTime = (timestamp: number) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("en-UG");
};
