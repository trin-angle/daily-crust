type Accent = "green" | "red" | "yellow" | "none";

const accentBorders: Record<Accent, string> = {
  green: "border-l-4 border-brand-green",
  red: "border-l-4 border-brand-red",
  yellow: "border-l-4 border-brand-yellow",
  none: "",
};

interface WeeklyReportCardProps {
  title: string;
  accent?: Accent;
  children: React.ReactNode;
}

export function WeeklyReportCard({ title, accent = "none", children }: WeeklyReportCardProps) {
  return (
    <div className={`bg-surface-card rounded-card p-6 ${accentBorders[accent]}`}>
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
