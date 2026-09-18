import type { MedicalSourceType } from "./types.ts";

export function classifyMedicalSource(url: string): MedicalSourceType {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/who\.int$|nice\.org\.uk$/.test(host)) return "GUIDELINE";
    if (/\.gov$|\.gov\.in$|nhs\.uk$/.test(host)) return "GOVERNMENT";
    if (/pubmed\.ncbi\.nlm\.nih\.gov$|cochranelibrary\.com$/.test(host)) return "ACADEMIC";
    if (/mayoclinic\.org$|clevelandclinic\.org$|msdmanuals\.com$/.test(host)) return "INSTITUTIONAL";
    return "WEB";
  } catch { return "WEB"; }
}

export function sourceAuthority(type: MedicalSourceType): number {
  return ({ GUIDELINE: 6, GOVERNMENT: 5, ACADEMIC: 4, INSTITUTIONAL: 3, CURATED: 2, WEB: 1 })[type];
}
