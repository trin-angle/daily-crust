"use client";

import type { DruidRegion } from "@/lib/types";

const REGIONS: { value: DruidRegion; label: string }[] = [
  { value: "all", label: "All" },
  { value: "osd-prod-gew1", label: "GEW1" },
  { value: "osd-prod-guc3", label: "GUC3" },
  { value: "osd-prod-gae2", label: "GAE2" },
];

interface RegionSelectorProps {
  selected: DruidRegion;
  onSelect: (region: DruidRegion) => void;
}

export function RegionSelector({ selected, onSelect }: RegionSelectorProps) {
  return (
    <div className="flex gap-1">
      {REGIONS.map((region) => (
        <button
          key={region.value}
          onClick={() => onSelect(region.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selected === region.value
              ? "bg-brand-green text-surface-base"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-card"
          }`}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
}
