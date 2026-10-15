/** A deterministic monthly stock-and-flow model. No people are scheduled or allocated. */
export const MODEL_VERSION = "healthy-homes/1.0.0";
export const BASELINE = {
  id: "healthy-homes/2026-09-12/v1",
  date: "2026-09-12",
  months: 12,
  neighborhoods: [
    { name: "Riverside", homes: 40, initialNeeds: 12, recurringNeeds: 2 },
    { name: "Parkside", homes: 40, initialNeeds: 10, recurringNeeds: 1.5 },
    { name: "Hilltop", homes: 40, initialNeeds: 8, recurringNeeds: 1 },
  ],
  offeredHours: 80,
  repairHours: 8,
  currentProductiveShare: 0.45,
  coordinatedProductiveShare: 0.65,
  preventionHours: 192,
  preventionMaterialUnits: 80,
  materialUnitsPerRepair: 1,
} as const;
export type PathwayKind = "current" | "coordinate" | "prevent";
export type Assumptions = {
  voluntaryHours: number;
  leadMonths: number;
  reductionPercent: number;
};
export type Pathway = {
  id: string;
  title: string;
  kind: PathwayKind;
  assumptions: Assumptions;
};
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  voluntaryHours: 16,
  leadMonths: 4,
  reductionPercent: 40,
};
export const PATHWAYS: readonly Pathway[] = [
  {
    id: "current",
    title: "Current practice",
    kind: "current",
    assumptions: { ...DEFAULT_ASSUMPTIONS },
  },
  {
    id: "coordinate",
    title: "Coordinate and share",
    kind: "coordinate",
    assumptions: { ...DEFAULT_ASSUMPTIONS },
  },
  {
    id: "prevent",
    title: "Invest in prevention",
    kind: "prevent",
    assumptions: { ...DEFAULT_ASSUMPTIONS },
  },
];
export const PATHWAY_COPY: Record<
  PathwayKind,
  { short: string; change: string; consent: string; reversal: string }
> = {
  current: {
    short: "Keep the existing repair process",
    change: "Continue local repair teams at the assumed current capacity.",
    consent:
      "Residents agree to repairs; contributors agree to working conditions.",
    reversal: "Repair commitments can be reviewed each month.",
  },
  coordinate: {
    short: "Share tools and voluntary time",
    change:
      "Pool capacity across neighborhoods; assume less time lost to coordination.",
    consent:
      "Tool-sharing agreements, resident consent and confirmed voluntary hours.",
    reversal:
      "End the sharing arrangement; preserve access to essential repairs.",
  },
  prevent: {
    short: "Do work now to reduce future need",
    change:
      "Share capacity and spend 192 productive hours on a preventive retrofit pilot.",
    consent:
      "Resident opt-in, paid or voluntary labor agreements, and permission to use materials.",
    reversal:
      "Stop further installations if harm appears. Installed materials and spent work cannot be recovered.",
  },
};
export type Month = {
  month: number;
  remaining: number;
  incoming: number;
  completed: number;
  repairHours: number;
  investmentHours: number;
  availableHours: number;
  materialUnits: number;
  neighborhoods: number[];
};
export type Evaluation = {
  modelVersion: string;
  baselineId: string;
  pathway: Pathway;
  stress: boolean;
  months: Month[];
  remaining: number;
  completed: number;
  incoming: number;
  workHours: number;
  investmentHours: number;
  materialUnits: number;
  recurringAtEnd: number;
  neighborhoodRemaining: number[];
  activationMonth: number | null;
  investmentComplete: boolean;
  peakRemaining: number;
};
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);

export function validateAssumptions(a: Assumptions): void {
  if (
    !Number.isFinite(a.voluntaryHours) ||
    a.voluntaryHours < 0 ||
    a.voluntaryHours > 80
  )
    throw new Error("Voluntary hours must be between 0 and 80 per month.");
  if (!Number.isInteger(a.leadMonths) || a.leadMonths < 1 || a.leadMonths > 12)
    throw new Error("Lead time must be a whole number from 1 to 12 months.");
  if (
    !Number.isFinite(a.reductionPercent) ||
    a.reductionPercent < 0 ||
    a.reductionPercent > 80
  )
    throw new Error("Recurring need reduction must be between 0% and 80%.");
}

export function evaluate(pathway: Pathway, stress = false): Evaluation {
  validateAssumptions(pathway.assumptions);
  const { kind, assumptions: a } = pathway;
  const pooling = kind !== "current";
  const preventive = kind === "prevent";
  // Sensitivity case, not a confidence interval or estimated probability.
  const capacityFactor = stress ? 0.75 : 1;
  const demandFactor = stress ? 1.25 : 1;
  const lead = Math.min(12, a.leadMonths + (stress ? 3 : 0));
  const reduction = (a.reductionPercent / 100) * (stress ? 0.5 : 1);
  const productiveHours =
    (BASELINE.offeredHours + (pooling ? a.voluntaryHours : 0)) *
    (pooling
      ? BASELINE.coordinatedProductiveShare
      : BASELINE.currentProductiveShare) *
    capacityFactor;
  let outstanding: number[] = BASELINE.neighborhoods.map((n) => n.initialNeeds);
  let investmentLeft = preventive ? BASELINE.preventionHours : 0;
  let activationMonth: number | null = null;
  const months: Month[] = [
    {
      month: 0,
      remaining: sum(outstanding),
      incoming: 0,
      completed: 0,
      repairHours: 0,
      investmentHours: 0,
      availableHours: 0,
      materialUnits: 0,
      neighborhoods: [...outstanding],
    },
  ];
  for (let month = 1; month <= BASELINE.months; month++) {
    const active = preventive && investmentLeft < 1e-9 && month > lead;
    if (active && activationMonth === null) activationMonth = month;
    const incomingByArea = BASELINE.neighborhoods.map(
      (n) => n.recurringNeeds * demandFactor * (active ? 1 - reduction : 1),
    );
    outstanding = outstanding.map((n, i) => n + incomingByArea[i]);
    // Reserve the declared monthly investment effort first. Shortfalls delay completion.
    const investmentHours = Math.min(
      productiveHours,
      investmentLeft,
      BASELINE.preventionHours / lead,
    );
    investmentLeft = clean(investmentLeft - investmentHours);
    const repairCapacity =
      Math.max(0, productiveHours - investmentHours) / BASELINE.repairHours;
    const totalNeed = sum(outstanding);
    const served = outstanding.map((n) =>
      pooling
        ? totalNeed > 0
          ? (n / totalNeed) * Math.min(totalNeed, repairCapacity)
          : 0
        : Math.min(n, repairCapacity / BASELINE.neighborhoods.length),
    );
    outstanding = outstanding.map((n, i) => clean(n - served[i]));
    const completed = sum(served);
    months.push({
      month,
      remaining: clean(sum(outstanding)),
      incoming: sum(incomingByArea),
      completed,
      repairHours: completed * BASELINE.repairHours,
      investmentHours,
      availableHours: productiveHours,
      materialUnits:
        completed * BASELINE.materialUnitsPerRepair +
        (investmentHours / BASELINE.preventionHours) *
          BASELINE.preventionMaterialUnits,
      neighborhoods: [...outstanding],
    });
  }
  const last = months.at(-1)!;
  return {
    modelVersion: MODEL_VERSION,
    baselineId: BASELINE.id,
    pathway: structuredClone(pathway),
    stress,
    months,
    remaining: last.remaining,
    completed: sum(months.map((m) => m.completed)),
    incoming: sum(months.map((m) => m.incoming)),
    workHours: sum(months.map((m) => m.repairHours + m.investmentHours)),
    investmentHours: sum(months.map((m) => m.investmentHours)),
    materialUnits: sum(months.map((m) => m.materialUnits)),
    recurringAtEnd: last.incoming,
    neighborhoodRemaining: last.neighborhoods,
    activationMonth,
    investmentComplete: investmentLeft < 1e-9,
    peakRemaining: Math.max(...months.map((m) => m.remaining)),
  };
}
export const number = (n: number, digits = 1) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
