"use client";

import type { InputHTMLAttributes } from "react";

/**
 * Date input that defaults to disallowing past dates (min = today). Any caller
 * can still override `min` explicitly (e.g. a date-of-birth field would pass its
 * own min/max). Used for appointment/booking date selection.
 */
export default function DatePicker({ className = "", min, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <input
      {...props}
      type="date"
      min={min ?? today}
      className={`min-h-11 w-full rounded-lg border border-[#dce9e3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#07947f] ${className}`}
    />
  );
}
