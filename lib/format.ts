// Shared display formatters.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Formats a number as INR, e.g. 1010 -> "₹1,010". */
export function formatINR(value: number | null | undefined): string {
  return inr.format(Number(value ?? 0));
}

/** Humanizes a snake_case / enum value, e.g. "follow_up" -> "Follow up". */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
