"use client";

import type { DruidProduct, DruidRegion } from "@/lib/types";

const PRODUCTS: { value: DruidProduct; label: string }[] = [
  { value: "music", label: "Music" },
  { value: "podcast", label: "Podcast" },
];

const REGIONS_BY_PRODUCT: Record<
  DruidProduct,
  { value: DruidRegion; label: string }[]
> = {
  music: [
    { value: "all", label: "All" },
    { value: "gew1", label: "GEW1" },
    { value: "guc3", label: "GUC3" },
  ],
  podcast: [
    { value: "all", label: "All" },
    { value: "gew4", label: "GEW4" },
    { value: "guc3", label: "GUC3" },
  ],
};

interface ClusterSelectorProps {
  product: DruidProduct;
  region: DruidRegion;
  onProductChange: (product: DruidProduct) => void;
  onRegionChange: (region: DruidRegion) => void;
}

export function ClusterSelector({
  product,
  region,
  onProductChange,
  onRegionChange,
}: ClusterSelectorProps) {
  const regions = REGIONS_BY_PRODUCT[product];

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {PRODUCTS.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              onProductChange(p.value);
              onRegionChange("all");
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              product === p.value
                ? "bg-brand-green text-surface-base"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-card"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <span className="text-text-secondary text-xs">|</span>
      <div className="flex gap-1">
        {regions.map((r) => (
          <button
            key={r.value}
            onClick={() => onRegionChange(r.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              region === r.value
                ? "bg-brand-green text-surface-base"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-card"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
