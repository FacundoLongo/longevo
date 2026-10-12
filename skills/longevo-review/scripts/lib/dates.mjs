// Dates Longevo writes and reads: YYYY-MM-DD, or YYYY-MM-DDTHH:MM:SS after a second check on the same day (D11).
const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;

// The shape, and a day that exists on the calendar (no 2026-02-30), with a time of day that exists.
export function realDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const [day, time] = value.split('T');
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
  if (!time) return true;
  const [h, min, s] = time.split(':').map(Number);
  return h < 24 && min < 60 && s < 60;
}
