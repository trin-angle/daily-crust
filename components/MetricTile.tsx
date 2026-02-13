type Status = "success" | "warning" | "error" | "neutral";

const statusColors: Record<Status, string> = {
  success: "text-brand-green",
  warning: "text-brand-yellow",
  error: "text-brand-red",
  neutral: "text-text-primary",
};

interface MetricTileProps {
  label: string;
  value: string;
  subtitle?: string;
  status?: Status;
  children?: React.ReactNode;
}

export function MetricTile({ label, value, subtitle, status = "neutral", children }: MetricTileProps) {
  return (
    <div className="bg-surface-card rounded-card p-5 hover:bg-surface-hover transition-colors">
      <p className="text-sm text-text-secondary mb-1">{label}</p>
      <p data-testid="metric-value" className={`text-3xl font-bold tracking-tight ${statusColors[status]}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
