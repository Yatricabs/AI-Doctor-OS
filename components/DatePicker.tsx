"use client";

import type { InputHTMLAttributes } from "react";

export default function DatePicker({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="date"
      className={`min-h-11 w-full rounded-lg border border-[#dce9e3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#07947f] ${className}`}
    />
  );
}
