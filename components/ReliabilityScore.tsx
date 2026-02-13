interface ReliabilityScoreProps {
  score: number;
  total: number;
  successful: number;
}

function getScoreColor(score: number): string {
  if (score >= 99.9) return "text-brand-green";
  if (score >= 99.5) return "text-brand-yellow";
  return "text-brand-red";
}

export function ReliabilityScore({ score, total, successful }: ReliabilityScoreProps) {
  return (
    <div className="text-center py-4">
      <p
        data-testid="reliability-score"
        className={`text-6xl font-bold tracking-tight ${getScoreColor(score)}`}
      >
        {score}%
      </p>
      <p className="text-text-secondary mt-2">
        {successful.toLocaleString()} of {total.toLocaleString()} queries
        succeeded
      </p>
    </div>
  );
}
