"use client";

import type { SelectHTMLAttributes } from "react";

export const APPOINTMENT_TIMES = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
];

export function formatTimeLabel(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export default function TimeSelect({ options = APPOINTMENT_TIMES, className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options?: string[] }) {
  return (
    <select
      {...props}
      className={`min-h-11 w-full rounded-lg border border-[#dce9e3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#07947f] ${className}`}
    >
      {children ?? <>
        <option value="">Select a time</option>
        {options.map((time) => <option key={time} value={time}>{formatTimeLabel(time)}</option>)}
      </>}
    </select>
  );
}
