import { titleize } from "@/lib/format";

type StatusChipProps = {
  tone?: "neutral" | "success" | "warning" | "danger";
  value: string;
};

export function StatusChip({ tone = "neutral", value }: StatusChipProps) {
  return (
    <span className={`status-chip status-chip--${tone}`}>{titleize(value)}</span>
  );
}
