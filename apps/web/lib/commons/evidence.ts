export const EVIDENCE = {
  baseline: {
    title: "Present conditions",
    status: "Synthetic fixture",
    value: "30 initial repair needs",
    explanation:
      "120 fictional homes, evenly divided between Riverside, Parkside and Hilltop. Initial repair needs are 12, 10 and 8. New repair needs are assumed to arrive at 2, 1.5 and 1 per month.",
    equation: "remaining = previous needs + new needs − completed repairs",
    limitation:
      "These are expected repair needs, not unique households. A home can need several repairs. Completing a repair is not evidence of improved health.",
    needed:
      "An opt-in condition survey, repair logs, and resident-defined standards for healthy homes.",
  },
  capacity: {
    title: "Coordination and capacity",
    status: "Modeling assumption",
    value: "45% → 65% productive time",
    explanation:
      "The district offers 80 work hours per month. Current practice uses 45% for repairs, split equally between neighborhoods. Sharing assumes 65% productive time and pools hours in proportion to outstanding need.",
    equation:
      "repair capacity = (offered hours × productive share − investment hours) ÷ 8",
    limitation:
      "The efficiency gain and proportional distribution rule are assumptions, not findings. Travel, specialist skills, urgency and household-level fairness are not modeled.",
    needed:
      "Time-use observations, skill and travel constraints, and an agreed distribution rule.",
  },
  voluntaryHours: {
    title: "Additional voluntary hours",
    status: "Unconfirmed offer",
    value: "16 hours per month",
    explanation:
      "Additional hours are available only to the sharing and prevention pathways. Their productive share is the same as the pooled base capacity. They are not individual assignments.",
    equation: "pooled productive hours = (80 + additional hours) × 0.65",
    limitation:
      "An available hour is not consent. The model assumes a reliable monthly offer; it cannot establish willingness or safe working conditions.",
    needed:
      "Explicit, revocable commitments with compensation, safety and withdrawal terms.",
  },
  leadMonths: {
    title: "Prevention lead time",
    status: "Modeling assumption",
    value: "4 months",
    explanation:
      "The pilot requires 192 productive hours. These are spread across the lead time and take priority over repairs. Benefits start the following month, only after all investment work is complete.",
    equation:
      "monthly investment = min(available hours, remaining investment, 192 ÷ lead time)",
    limitation:
      "A capacity shortfall delays completion. Materials, permissions or unforeseen work could introduce other delays that this model does not estimate.",
    needed:
      "A scoped pilot, contractor estimates, procurement lead times and resident permission.",
  },
  reductionPercent: {
    title: "Prevention effect",
    status: "Modeling assumption",
    value: "40% fewer recurring needs",
    explanation:
      "After the pilot is complete, a district-wide fractional reduction is applied to new repair needs. It does not remove existing needs. All neighborhoods receive the same proportional effect.",
    equation:
      "new needs after activation = original recurring needs × (1 − reduction / 100)",
    limitation:
      "The magnitude, persistence and equal distribution of this effect are unvalidated. The 0–80% input bounds are exploration limits, not confidence bounds.",
    needed:
      "A small controlled pilot, condition measurements, recurrence records and a check for unequal benefits.",
  },
  materials: {
    title: "Material demand",
    status: "Illustrative proxy",
    value: "1 unit per repair + 80 for prevention",
    explanation:
      "A repair-equivalent material unit is an accounting proxy. The preventive pilot uses 80 additional units, proportional to investment work actually completed.",
    equation:
      "material units = repairs completed + investment hours ÷ 192 × 80",
    limitation:
      "No inventory constraint or cost is modeled. Different materials are not environmentally interchangeable. Energy, carbon, toxicity and biodiversity effects are unknown, not zero.",
    needed:
      "A bill of materials, supplier capacity, lifecycle evidence and ecological limits.",
  },
} as const;
export type EvidenceKey = keyof typeof EVIDENCE;
