"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type AutocompletePatient = {
  id: string;
  name: string;
  initials?: string;
  phone?: string;
  appointment?: string;
  patientType?: string;
};

type Props = {
  patients: AutocompletePatient[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (patient: AutocompletePatient) => void;
  placeholder?: string;
  label?: string;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  className?: string;
  inputClassName?: string;
  renderOption?: (patient: AutocompletePatient) => React.ReactNode;
};

function searchable(patient: AutocompletePatient): string {
  return [patient.name, patient.initials, patient.id, patient.phone].filter(Boolean).join(" ").toLowerCase();
}

export function filterPatients(patients: AutocompletePatient[], query: string): AutocompletePatient[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return patients;
  const digits = normalized.replace(/\D/g, "");
  return patients.filter((patient) => {
    const textMatch = searchable(patient).includes(normalized);
    const phoneMatch = digits.length > 0 && (patient.phone ?? "").replace(/\D/g, "").includes(digits);
    return textMatch || phoneMatch;
  });
}

export default function PatientAutocomplete({ patients, value, onChange, onSelect, placeholder = "Search patient name, ID or phone", label, loading = false, error, emptyMessage = "No matching patients.", className = "", inputClassName = "", renderOption }: Props) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => filterPatients(patients, value).slice(0, 8), [patients, value]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(patient: AutocompletePatient) {
    onChange(patient.name);
    onSelect(patient);
    setOpen(false);
    setActive(0);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && <label htmlFor={`${listId}-input`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5a967e]">{label}</label>}
      <input
        id={`${listId}-input`}
        value={value}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter")) { setOpen(true); return; }
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, Math.max(0, matches.length - 1))); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
          else if (event.key === "Enter" && matches[active]) { event.preventDefault(); choose(matches[active]); }
          else if (event.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f] ${inputClassName}`}
      />
      {open && (loading || error || value.trim()) && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-[#dce9e3] bg-white shadow-lg">
          {loading && <p className="px-3 py-2 text-xs text-[#78908a]">Loading patients…</p>}
          {!loading && error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
          {!loading && !error && value.trim() && matches.length === 0 && <p className="px-3 py-2 text-xs text-[#78908a]">{emptyMessage}</p>}
          {!loading && !error && matches.map((patient, index) => (
            <button key={patient.id} id={`${listId}-${patient.id}`} type="button" role="option" aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(patient)} className={`flex w-full items-center gap-3 px-3 py-2 text-left ${index === active ? "bg-[#edf7f2]" : "hover:bg-[#f7faf8]"}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d5eee4] text-[11px] font-bold text-[#277a6b]">{patient.initials ?? patient.name.slice(0, 2).toUpperCase()}</span>
              {renderOption ? renderOption(patient) : <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#24443f]">{patient.name}</span><span className="block truncate text-[11px] text-[#8a9e98]">{patient.id}{patient.phone ? ` · ${patient.phone}` : ""}</span></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
