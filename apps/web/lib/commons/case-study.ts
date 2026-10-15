import { BASELINE, evaluate, number, type Pathway } from "./model";
import { type EvidenceKey } from "./evidence";
import { type Challenge, type Decision, type Workspace } from "./workspace";

export type CaseArea = (typeof BASELINE.neighborhoods)[number]["name"];
export type TeamMember = {
  id: string;
  name: string;
  initials: string;
  role: string;
  area: CaseArea | "All";
  focus: string;
};
export type CaseBuilding = {
  id: string;
  name: string;
  area: CaseArea;
  homes: number;
  startingRepairs: number;
  stewardId: string;
  note: string;
};
export type RepairItem = {
  id: string;
  buildingId: string;
  neighborhood: CaseArea;
  home: string;
  category: "damp" | "heating" | "leak" | "ventilation" | "envelope";
  issue: string;
  priority: "urgent" | "high" | "routine";
  status: "open" | "scheduled" | "blocked" | "resolved";
  assigneeId: string;
  assignee: string;
  hours: number;
  reportedAt: string;
  updatedAt: string;
  note: string;
};
export type CaseEvidence = {
  id: string;
  title: string;
  date: string;
  authorId: string;
  author: string;
  target: EvidenceKey;
  kind: "register" | "diary" | "minutes" | "inspection" | "invoice" | "review";
  summary: string;
  content: string[];
  finding: string;
  reference: string;
  limitation: string;
  recordIds: string[];
};
export type CaseActivity = {
  id: string;
  createdAt: string;
  kind: "decision" | "challenge" | "observation";
  memberId: string;
  title: string;
  detail: string;
  recordId: string;
};

export const TEAM: readonly TeamMember[] = [
  {
    id: "maya",
    name: "Maya Chen",
    initials: "MC",
    role: "Pilot coordinator",
    area: "All",
    focus:
      "Owns the March review and the boundary on expansion. Reconfirms household access after a schedule change and keeps deferred homes outside the installation scope.",
  },
  {
    id: "eli",
    name: "Eli Moreno",
    initials: "EM",
    role: "Maintenance lead",
    area: "All",
    focus:
      "Triages unresolved repairs and separates moisture diagnosis from installed work. Checks contractor hours, inspection records and urgent response windows before declaring a job closed.",
  },
  {
    id: "leila",
    name: "Leila Okafor",
    initials: "LO",
    role: "Resident steward",
    area: "Riverside",
    focus:
      "Arranges Riverside access and follows up repeat damp reports with residents. Challenged the original 40% recurrence claim when roof and pipe defects were being treated as preventable by seals and fans.",
  },
  {
    id: "jon",
    name: "Jon Bell",
    initials: "JB",
    role: "Resident steward",
    area: "Parkside",
    focus:
      "Coordinates Parkside's shared-duct and roof visits without inferring permission from membership. Raised the November capacity conflict and keeps provisional closures open until residents confirm them.",
  },
  {
    id: "sana",
    name: "Sana Patel",
    initials: "SP",
    role: "Resident steward",
    area: "Hilltop",
    focus:
      "Handles Hilltop access and the ground-floor water-ingress follow-up. Checks that volunteers can withdraw and that households which decline extra work keep the same repair priority.",
  },
  {
    id: "theo",
    name: "Theo Grant",
    initials: "TG",
    role: "Finance & records",
    area: "All",
    focus:
      "Reconciles repair arrivals, accepted closures and the £7,200 budget envelope. Keeps supplier prices separate from the model's material index and records corrections without deleting earlier counts.",
  },
];

export const BUILDINGS: readonly CaseBuilding[] = [
  {
    id: "RS-A",
    name: "Riverside North",
    area: "Riverside",
    homes: 20,
    startingRepairs: 7,
    stewardId: "leila",
    note: "1968 brick walk-up; recurring window condensation on the north face.",
  },
  {
    id: "RS-B",
    name: "Riverside South",
    area: "Riverside",
    homes: 20,
    startingRepairs: 5,
    stewardId: "leila",
    note: "Shared heating loop; two distribution valves remain on the replacement list.",
  },
  {
    id: "PS-A",
    name: "Parkside Court",
    area: "Parkside",
    homes: 20,
    startingRepairs: 6,
    stewardId: "jon",
    note: "Top-floor leaks cluster around the older roof drainage run.",
  },
  {
    id: "PS-B",
    name: "Parkside Mews",
    area: "Parkside",
    homes: 20,
    startingRepairs: 4,
    stewardId: "jon",
    note: "Bathroom fans vent into a shared duct; access requires two households.",
  },
  {
    id: "HT-A",
    name: "Hilltop East",
    area: "Hilltop",
    homes: 20,
    startingRepairs: 3,
    stewardId: "sana",
    note: "Exposed entrance seals and intermittent hallway heating.",
  },
  {
    id: "HT-B",
    name: "Hilltop West",
    area: "Hilltop",
    homes: 20,
    startingRepairs: 5,
    stewardId: "sana",
    note: "Ground-floor seepage after heavy rain; patch repairs have recurred.",
  },
];

const sharedRota: Pathway = {
  id: "alder-shared-rota",
  title: "Shared rota",
  kind: "coordinate",
  assumptions: { voluntaryHours: 16, leadMonths: 4, reductionPercent: 40 },
};
const fourMonth: Pathway = {
  id: "alder-four-month-retrofit",
  title: "Four-month retrofit",
  kind: "prevent",
  assumptions: { voluntaryHours: 16, leadMonths: 4, reductionPercent: 40 },
};
const sixMonth: Pathway = {
  id: "alder-six-month-retrofit",
  title: "Six-month retrofit",
  kind: "prevent",
  assumptions: { voluntaryHours: 16, leadMonths: 6, reductionPercent: 20 },
};
const reducedRota: Pathway = {
  id: "alder-eight-hour-rota",
  title: "Eight-hour rota",
  kind: "prevent",
  assumptions: { voluntaryHours: 8, leadMonths: 6, reductionPercent: 20 },
};
export const ACTIVE_CASE_PATHWAY = sixMonth;

const forecast = (pathway: Pathway, month: number) =>
  number(evaluate(pathway).months[month].remaining);

const challenges: Challenge[] = [
  {
    id: "alder-challenge-01",
    pathway: structuredClone(sharedRota),
    target: "capacity",
    createdAt: "2026-09-16T17:30:00.000Z",
    text: "Eli Moreno: 65% productive time assumes that travel, keys and tool collection are coordinated. Our September diary put those losses at 43% of offered time. Keep separate time entries for repairs, retrofit, travel and access; review after two months before claiming that pooling works.",
  },
  {
    id: "alder-challenge-02",
    pathway: structuredClone(sharedRota),
    target: "voluntaryHours",
    createdAt: "2026-09-17T15:00:00.000Z",
    text: "Sana Patel: the 16 extra hours come from four people, not all 120 households. Two are carers. Publish the rota two weeks ahead, accept withdrawals without penalty, and compare an eight-hour month. Repair priority must not depend on volunteering.",
  },
  {
    id: "alder-challenge-03",
    pathway: structuredClone(fourMonth),
    target: "materials",
    createdAt: "2026-10-13T10:00:00.000Z",
    text: "Theo Grant: 80 material units are a model index, not £80 or 80 kits. Supplier quote AQ-26-104 covers 24 homes at £6,240 plus £960 contingency; it excludes roof membranes and two heating valves. Do not convert the model total into a purchase order.",
  },
  {
    id: "alder-challenge-04",
    pathway: structuredClone(fourMonth),
    target: "reductionPercent",
    createdAt: "2026-10-14T18:00:00.000Z",
    text: "Leila Okafor: 40% fewer new repair units is unsupported. Seals and fans may reduce damp but cannot fix roof drainage, boilers or old pipe joints. Use 20% for the next comparison; keep incoming problems by category and compare a full winter before claiming an effect.",
  },
  {
    id: "alder-challenge-05",
    pathway: structuredClone(fourMonth),
    target: "leadMonths",
    createdAt: "2026-11-15T12:00:00.000Z",
    text: "Jon Bell: the four-month schedule reserves 48 productive hours each month and leaves only 1.8 repair units of capacity. With 36 unresolved units in the November register, that allocation is untenable. Spread the same 192 retrofit hours over six months and protect urgent visits first.",
  },
  {
    id: "alder-challenge-06",
    pathway: structuredClone(sixMonth),
    target: "baseline",
    createdAt: "2027-01-14T16:00:00.000Z",
    text: "Maya Chen: one repair unit can be a fan replacement or a recurring leak; neither is one household. January's 37 unresolved units affect 29 homes. The model treats them as equal eight-hour jobs and averages monthly arrivals. Show both counts in the review and keep urgent hazards out of the ordinary queue.",
  },
  {
    id: "alder-challenge-07",
    pathway: structuredClone(sixMonth),
    target: "capacity",
    createdAt: "2027-02-14T14:00:00.000Z",
    text: "Eli Moreno: 168 of 192 retrofit hours are logged by February, but the December and January repair diary includes specialist hours outside the modeled pool. Those hours do not prove the cooperative can sustain 65% productivity. Audit the extra contractor time before approving another building.",
  },
];

const decisions: Decision[] = [
  {
    id: "alder-decision-01",
    parentId: null,
    createdAt: "2026-09-18T18:00:00.000Z",
    pathway: structuredClone(sharedRota),
    challenges: structuredClone(challenges.slice(0, 2)),
    action:
      "Run one shared repair rota across Riverside, Parkside and Hilltop for October. Eli holds the tool cupboard keys; each resident steward confirms access before Thursday's work list is published. Reserve the existing 80 offered hours plus up to 16 opt-in hours; do not book retrofit work yet.",
    rationale: `There are 30 unresolved repair units across 120 homes. Separate crews lose time collecting tools and arranging access. The shared-rota scenario predicts ${forecast(sharedRota, 1)} unresolved units after one month and ${forecast(sharedRota, 6)} after six; these are workload estimates, not promises to residents. Test the coordination change before buying materials.`,
    steward: "Eli Moreno · maintenance lead",
    authority:
      "Alder maintenance committee, minutes AM-2026-09-18, approved a one-month rota trial within the existing repair budget. Maya Chen can coordinate access; Eli can assign agreed work. Neither can enter a home or expand the pilot without permission.",
    consent:
      "Resident consent is recorded separately for every visit. Four contributors offered up to four hours each for October; they may withdraw. Leila, Jon and Sana check that non-volunteers receive the same repair priority. No access agreement is inferred from cooperative membership.",
    reviewDate: "2026-10-15",
    success:
      "Close at least six repair units in October; publish the unresolved count by area; log offered, productive and access-loss hours separately. Every urgent report receives a same-day triage call and an agreed safety response before routine work.",
    reversal:
      "End the pooled rota if a resident loses repair access, if a volunteer is pressured to continue, or if fewer than six units close without an explained access delay. Return keys and outstanding jobs to the area stewards; retain every repair commitment.",
  },
  {
    id: "alder-decision-02",
    parentId: "alder-decision-01",
    createdAt: "2026-10-15T18:30:00.000Z",
    pathway: structuredClone(fourMonth),
    challenges: structuredClone(challenges.slice(0, 4)),
    action:
      "Keep the shared rota and invite eight homes in each area to a ventilation-and-seal retrofit pilot. Cap the initial materials order at £6,240, with £960 held as contingency. Eli checks fan routes and moisture sources before any installation; Maya records individual opt-ins.",
    rationale: `October closed seven repair units and added five, leaving 28 unresolved. Residents asked for fewer repeat damp visits. The four-month scenario reserves 48 productive hours a month for retrofit and predicts ${forecast(fourMonth, 4)} unresolved units at its peak, then ${forecast(fourMonth, 12)} at month 12. We are accepting a temporary backlog increase to test recurrence reduction; the 40% assumption remains disputed.`,
    steward: "Maya Chen · pilot coordinator",
    authority:
      "Maintenance committee minutes AM-2026-10-15 authorize a 24-home invitation and the initial purchase cap. Theo releases funds only against the itemized quote; any roof or boiler work goes through the separate repair budget. A district-wide retrofit has not been authorized.",
    consent:
      "A home joins only after a resident reviews the work, access window and withdrawal route. Twenty of the 24 invited homes opted in; four deferred. No installation occurs in a deferred home. Workers agree task scope, safety arrangements and compensation before booking.",
    reviewDate: "2026-11-18",
    success:
      "Complete the access survey in all 20 consenting homes; publish a parts list and actual retrofit hours. Keep urgent repair access intact. Bring a four- versus six-month comparison and the challenged 20% reduction assumption to the November review before releasing the next batch.",
    reversal:
      "Pause the next batch if unresolved units exceed 35, a survey finds a moisture source that sealing could worsen, or an urgent visit is delayed by retrofit work. Unspent contingency remains held. Completed safe installations stay in place; assess removal individually if harm is reported.",
  },
  {
    id: "alder-decision-03",
    parentId: "alder-decision-02",
    createdAt: "2026-11-18T18:00:00.000Z",
    pathway: structuredClone(sixMonth),
    challenges: structuredClone(challenges.slice(0, 5)),
    action:
      "Replace the four-month comparison with a six-month schedule and a 20% recurrence assumption. Cap planned retrofit effort at 32 productive hours a month, with urgent repairs taking precedence. Continue only the 20 opted-in homes; route roof leaks and heating valves to specialist repair work.",
    rationale: `November added ten repair units and closed two, leaving 36; the previous pause threshold was crossed and the next batch was held. A six-month comparison leaves ${forecast(sixMonth, 6)} unresolved units at month 6 and ${forecast(sixMonth, 12)} at month 12, versus ${forecast(fourMonth, 6)} and ${forecast(fourMonth, 12)} for the original four-month comparison. The slower schedule releases more repair capacity now and claims less benefit later. Neither forecast models the actual sequence of our changes.`,
    steward: "Eli Moreno · maintenance lead; Maya Chen · access coordinator",
    authority:
      "Maintenance committee minutes AM-2026-11-18 release the held batch under the revised hour cap. Theo retains the £960 contingency; the committee must approve any increase. Area stewards can stop an individual visit when access or safety conditions are unmet.",
    consent:
      "Reconfirm scope with the same 20 households after the schedule change. Leila, Jon and Sana offer separate access slots; no household has to accept a shared appointment. Volunteers confirm each monthly rota; declining hours does not change a household's repair position.",
    reviewDate: "2027-02-16",
    success:
      "Finish the 192-hour modeled retrofit scope without expanding the consent group. Report remaining repair units and affected homes separately each month. Keep all urgent visits within their agreed response window; compare recurring damp reports only after the scope is complete and winter conditions are recorded.",
    reversal:
      "Stop new installations if unresolved units exceed 40 at a reconciled month-end, if two urgent visits miss their agreed safety response, or if a retrofit worsens moisture or ventilation. Move available cooperative hours to repairs; retain the opt-out route and commission an independent inspection of any affected installation.",
  },
  {
    id: "alder-decision-04",
    parentId: "alder-decision-03",
    createdAt: "2027-02-16T18:00:00.000Z",
    pathway: structuredClone(sixMonth),
    challenges: structuredClone(challenges),
    action:
      "Finish the existing retrofit scope; authorize no additional homes. Eli closes the final inspection list and gives repairs the next unallocated slot. Theo reconciles contractor hours and materials. Bring the March backlog count, household count and recurrence log to the committee before considering expansion.",
    rationale: `February has 39 unresolved units versus ${forecast(sixMonth, 5)} in the six-month comparison. The diary records 168 retrofit hours and 16 inspected homes; four inspections remain. The 20% reduction is still an assumption, with benefits only modeled from month ${evaluate(sixMonth).activationMonth}. Finish and inspect the small pilot while protecting repairs; evidence does not support expanding it.`,
    steward: "Maya Chen · review owner; Theo Grant · reconciliation",
    authority:
      "Maintenance committee minutes AM-2027-02-16 approve completion of the existing scope only. Theo can pay accepted invoices within the original £7,200 envelope. Expansion, an increased budget or new household invitations require a fresh committee decision and individual consent.",
    consent:
      "All 20 participants receive an inspection appointment and a plain record of installed work; four deferred homes remain outside the pilot. No resident is required to provide indoor sensor data. Recurrence reports are collected through stewards with household identifiers withheld from the shared export.",
    reviewDate: "2027-03-19",
    success:
      "Reconcile all 192 retrofit hours, inspect all 20 participating homes and document any outstanding defects. Publish the six-month stock balance and all specialist hours. Do not claim a 20% improvement from a single month; agree a full-winter comparison and a follow-up inspection before requesting expansion.",
    reversal:
      "Keep expansion paused while the audited backlog is 40 or higher. If it exceeds 40, redirect the next available cooperative hours to repairs and request a specialist capacity review. Any installation-related harm pauses that installation type immediately; offer assessment and remedial work without requiring continued participation.",
  },
];

const observations: Workspace["observations"] = [
  {
    id: "alder-observation-01",
    decisionId: "alder-decision-01",
    createdAt: "2026-10-10T16:00:00.000Z",
    month: 1,
    remaining: 29,
    note: "Leila Okafor · preliminary October count. Six closures are verified and five new issues have arrived: 30 + 5 − 6 = 29. A seventh fan replacement awaits resident confirmation. Four Riverside visits moved when access slots changed; the rota records the lost time rather than treating those homes as refusals.",
  },
  {
    id: "alder-observation-02",
    decisionId: "alder-decision-01",
    createdAt: "2026-10-12T17:00:00.000Z",
    month: 1,
    remaining: 28,
    note: "Theo Grant · reconciled October register. The resident confirmed the seventh closure: 30 + 5 − 7 = 28, across 23 homes. Riverside 12, Parkside 9, Hilltop 7. The shared-rota comparison predicts 26.7; the 1.3-unit gap reflects access delays and one more arrival than its 4.5-unit monthly average. This supersedes the provisional count of 29 without deleting it.",
  },
  {
    id: "alder-observation-03",
    decisionId: "alder-decision-02",
    createdAt: "2026-11-10T16:00:00.000Z",
    month: 2,
    remaining: 37,
    note: "Jon Bell · preliminary November count. Ten arrivals followed the cold spell, including six pipe-joint or roof-drainage leaks outside the retrofit scope. Only one repair closure is verified: 28 + 10 − 1 = 37. The second heating-valve repair is awaiting its pressure-test record. Hold the next retrofit batch because the decision's 35-unit threshold has been crossed.",
  },
  {
    id: "alder-observation-04",
    decisionId: "alder-decision-02",
    createdAt: "2026-11-12T17:00:00.000Z",
    month: 2,
    remaining: 36,
    note: "Eli Moreno · reconciled November register. Both closures now have resident confirmation and test records: 28 + 10 − 2 = 36, across 28 homes. Riverside 15, Parkside 12, Hilltop 9. This exceeds the four-month comparison's 35.4 and triggers its pause condition. The six-month alternative is a new September-baseline comparison, not a forecast stitched to the actual October rota.",
  },
  {
    id: "alder-observation-05",
    decisionId: "alder-decision-03",
    createdAt: "2026-12-12T17:00:00.000Z",
    month: 3,
    remaining: 35,
    note: "Sana Patel · reconciled December register. Five new units and six closures: 36 + 5 − 6 = 35, across 27 homes. Riverside 14, Parkside 12, Hilltop 9. Two closures used separately funded specialist time. All urgent reports received the agreed safety response; do not treat contractor-supported throughput as proof of the pooled-hours assumption. Retrofit log: 104 hours to date.",
  },
  {
    id: "alder-observation-06",
    decisionId: "alder-decision-03",
    createdAt: "2027-01-10T16:00:00.000Z",
    month: 4,
    remaining: 38,
    note: "Leila Okafor · preliminary January register. Six arrivals and three verified closures: 35 + 6 − 3 = 38. A Riverside condensation job was marked complete after sealing, but the resident reports a wet sill after rain. Keep it open pending a source check; do not count an installation as a successful repair.",
  },
  {
    id: "alder-observation-07",
    decisionId: "alder-decision-03",
    createdAt: "2027-01-12T17:00:00.000Z",
    month: 4,
    remaining: 37,
    note: "Theo Grant · reconciled January register. A separate Parkside fan replacement is confirmed; the wet-sill job stays open. Six arrivals and four closures: 35 + 6 − 4 = 37, across 29 homes. Riverside 15, Parkside 13, Hilltop 9. The selected comparison predicts 32.8. Retrofit work totals 136 hours; the inspection log distinguishes completed work from accepted installations.",
  },
  {
    id: "alder-observation-08",
    decisionId: "alder-decision-03",
    createdAt: "2027-02-12T17:00:00.000Z",
    month: 5,
    remaining: 39,
    note: "Maya Chen · reconciled February register. Six arrivals and four closures: 37 + 6 − 4 = 39, across 31 homes. Riverside 16, Parkside 13, Hilltop 10. Retrofit work totals 168 hours and 16 of 20 homes have final inspection records. No urgent response window was missed. The backlog is 5.5 above the 33.5-unit comparison; expansion remains on hold.",
  },
  {
    id: "alder-observation-09",
    decisionId: "alder-decision-04",
    createdAt: "2027-03-10T16:00:00.000Z",
    month: 6,
    remaining: 42,
    note: "Jon Bell · preliminary March register. Five arrivals are recorded and two closures are verified: 39 + 5 − 2 = 42. Two other completed jobs await resident confirmation. Eli has moved the next unallocated work slot to repairs while the count is reconciled; no additional retrofit invitation or order has been issued.",
  },
  {
    id: "alder-observation-10",
    decisionId: "alder-decision-04",
    createdAt: "2027-03-12T17:00:00.000Z",
    month: 6,
    remaining: 40,
    note: "Theo Grant · reconciled March register. Four closures are confirmed: 39 + 5 − 4 = 40, across 32 homes. Riverside 17, Parkside 13, Hilltop 10. From September: 30 starting units + 37 new − 27 closed = 40. Retrofit work totals 192 hours and all 20 opted-in homes are inspected. The selected fixed-baseline comparison predicts 34.2, a 5.8-unit gap. Expansion stays paused at the decision's 40-unit boundary; there is no measured 20% recurrence reduction yet.",
  },
];

export const CASE_WORKSPACE: Workspace = {
  version: 1,
  branches: [sharedRota, fourMonth, sixMonth, reducedRota].map((p) =>
    structuredClone(p),
  ),
  challenges,
  decisions,
  observations,
};

/** The physical case ledger; forecasts always come from evaluate(), not these counts. */
export const CASE_MONTHS = [
  {
    month: 0,
    date: "2026-09-12",
    incoming: 0,
    closed: 0,
    remaining: 30,
    affectedHomes: 25,
    areas: [12, 10, 8],
    retrofitHours: 0,
  },
  {
    month: 1,
    date: "2026-10-12",
    incoming: 5,
    closed: 7,
    remaining: 28,
    affectedHomes: 23,
    areas: [12, 9, 7],
    retrofitHours: 0,
  },
  {
    month: 2,
    date: "2026-11-12",
    incoming: 10,
    closed: 2,
    remaining: 36,
    affectedHomes: 28,
    areas: [15, 12, 9],
    retrofitHours: 72,
  },
  {
    month: 3,
    date: "2026-12-12",
    incoming: 5,
    closed: 6,
    remaining: 35,
    affectedHomes: 27,
    areas: [14, 12, 9],
    retrofitHours: 104,
  },
  {
    month: 4,
    date: "2027-01-12",
    incoming: 6,
    closed: 4,
    remaining: 37,
    affectedHomes: 29,
    areas: [15, 13, 9],
    retrofitHours: 136,
  },
  {
    month: 5,
    date: "2027-02-12",
    incoming: 6,
    closed: 4,
    remaining: 39,
    affectedHomes: 31,
    areas: [16, 13, 10],
    retrofitHours: 168,
  },
  {
    month: 6,
    date: "2027-03-12",
    incoming: 5,
    closed: 4,
    remaining: 40,
    affectedHomes: 32,
    areas: [17, 13, 10],
    retrofitHours: 192,
  },
] as const;

export const CASE_STUDY = {
  id: "alder-winter-2026",
  title: "Alder",
  organization: "Alder Housing Cooperative",
  cooperative: "Alder Housing Cooperative",
  project: "Winter repairs",
  description: "120 homes · Riverside, Parkside & Hilltop",
  summary:
    "A six-month repair and retrofit pilot. Forty repair units remain; the team is holding expansion until the March review.",
  label: "Synthetic case",
  baselineDate: BASELINE.date,
  snapshotDate: "2027-03-12",
  snapshotMonth: 6,
  nextReviewDate: "2027-03-19",
  activeDecisionId: "alder-decision-04",
  activePathwayId: ACTIVE_CASE_PATHWAY.id,
  status: "Expansion paused",
  homes: BASELINE.neighborhoods.reduce((sum, area) => sum + area.homes, 0),
  invitedHomes: 24,
  pilotHomes: 20,
  budget: {
    currency: "GBP",
    approved: 7200,
    committed: 6240,
    contingency: 960,
  },
  registerScope:
    "The 30 September repair units. At March, 21 of these are closed and 9 remain; 31 unresolved units reported after September are in the monthly ledger.",
  forecastScope:
    "Each saved comparison reruns from the same September baseline. It does not simulate the sequence of actual decisions, specialist hours or changing winter weather.",
} as const;

const repairRows = [
  {
    id: "R-001",
    buildingId: "RS-A",
    area: "Riverside",
    home: "03",
    category: "damp",
    issue: "Mould returns behind bedroom wardrobe",
    priority: "high",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-03",
    updatedAt: "2027-01-08",
    note: "Source check found an obstructed air path. Vent cleared and resident confirmed dry wall after four weeks; retain winter follow-up.",
  },
  {
    id: "R-002",
    buildingId: "RS-A",
    area: "Riverside",
    home: "06",
    category: "ventilation",
    issue: "Bathroom fan does not extract",
    priority: "high",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-04",
    updatedAt: "2026-10-12",
    note: "Fan replaced; airflow check and resident confirmation filed. This is the seventh October closure.",
  },
  {
    id: "R-003",
    buildingId: "RS-A",
    area: "Riverside",
    home: "08",
    category: "envelope",
    issue: "North-facing window seal admits rain",
    priority: "high",
    status: "open",
    assigneeId: "eli",
    reportedAt: "2026-09-05",
    updatedAt: "2027-03-08",
    note: "Seal patch did not address the wet sill. Keep open; masonry source check booked before another seal is fitted.",
  },
  {
    id: "R-004",
    buildingId: "RS-A",
    area: "Riverside",
    home: "11",
    category: "heating",
    issue: "Bedroom radiator remains cold",
    priority: "high",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-05",
    updatedAt: "2026-11-12",
    note: "Valve replaced by heating specialist. Pressure test filed; resident confirmed heat. Separate contractor hours in the ledger.",
  },
  {
    id: "R-005",
    buildingId: "RS-A",
    area: "Riverside",
    home: "14",
    category: "leak",
    issue: "Kitchen trap leaks under sink",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-07",
    updatedAt: "2026-10-08",
    note: "Trap and washer replaced during an agreed visit; dry check passed after 48 hours.",
  },
  {
    id: "R-006",
    buildingId: "RS-A",
    area: "Riverside",
    home: "14",
    category: "damp",
    issue: "Condensation at living-room reveal",
    priority: "routine",
    status: "resolved",
    assigneeId: "leila",
    reportedAt: "2026-09-08",
    updatedAt: "2027-02-08",
    note: "Vent route corrected; installed work inspected and resident reports no repeat staining. Closure does not establish a district-wide prevention effect.",
  },
  {
    id: "R-007",
    buildingId: "RS-A",
    area: "Riverside",
    home: "19",
    category: "envelope",
    issue: "Draught at rear balcony door",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-09",
    updatedAt: "2026-12-09",
    note: "Hinge alignment and weather strip complete; access appointment kept separate from the retrofit invitation.",
  },
  {
    id: "R-008",
    buildingId: "RS-B",
    area: "Riverside",
    home: "02",
    category: "heating",
    issue: "Heating-loop isolation valve seeps",
    priority: "urgent",
    status: "scheduled",
    assigneeId: "eli",
    reportedAt: "2026-09-02",
    updatedAt: "2027-03-11",
    note: "Specialist isolated the drip safely; permanent valve replacement set for March 16. Safety response completed; repair remains unresolved until test and confirmation.",
  },
  {
    id: "R-009",
    buildingId: "RS-B",
    area: "Riverside",
    home: "07",
    category: "ventilation",
    issue: "Extractor rattles and loses suction",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-06",
    updatedAt: "2026-10-09",
    note: "Loose mount corrected and duct obstruction removed; airflow record attached to work ticket.",
  },
  {
    id: "R-010",
    buildingId: "RS-B",
    area: "Riverside",
    home: "10",
    category: "leak",
    issue: "Washing-machine feed joint drips",
    priority: "high",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-07",
    updatedAt: "2026-12-10",
    note: "Joint replaced by specialist; this closure used hours outside the shared model pool.",
  },
  {
    id: "R-011",
    buildingId: "RS-B",
    area: "Riverside",
    home: "15",
    category: "damp",
    issue: "Recurring patch below upstairs shower",
    priority: "high",
    status: "blocked",
    assigneeId: "leila",
    reportedAt: "2026-09-10",
    updatedAt: "2027-03-09",
    note: "Need consent from both homes for a source inspection. Upstairs resident has requested a later access window; no entry permission is assumed.",
  },
  {
    id: "R-012",
    buildingId: "RS-B",
    area: "Riverside",
    home: "07",
    category: "envelope",
    issue: "Entrance threshold admits cold air",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-11",
    updatedAt: "2027-02-09",
    note: "Threshold adjusted and sweep fitted; resident accepted the work after inspection.",
  },
  {
    id: "R-013",
    buildingId: "PS-A",
    area: "Parkside",
    home: "01",
    category: "leak",
    issue: "Roof drainage stains top-floor ceiling",
    priority: "high",
    status: "open",
    assigneeId: "jon",
    reportedAt: "2026-09-01",
    updatedAt: "2027-03-10",
    note: "Temporary gutter clearance reduced flow but staining returned. Roof contractor survey requested; excluded from the retrofit kit quote.",
  },
  {
    id: "R-014",
    buildingId: "PS-A",
    area: "Parkside",
    home: "04",
    category: "heating",
    issue: "Radiator airlock in second bedroom",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-04",
    updatedAt: "2026-10-06",
    note: "Loop balanced and air cleared; temperature check accepted after the visit.",
  },
  {
    id: "R-015",
    buildingId: "PS-A",
    area: "Parkside",
    home: "09",
    category: "ventilation",
    issue: "Kitchen fan outlet flap stuck",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-05",
    updatedAt: "2026-10-07",
    note: "Outlet cleaned and flap replaced; no shared-duct alteration required.",
  },
  {
    id: "R-016",
    buildingId: "PS-A",
    area: "Parkside",
    home: "12",
    category: "damp",
    issue: "Moisture behind hall skirting",
    priority: "high",
    status: "scheduled",
    assigneeId: "jon",
    reportedAt: "2026-09-06",
    updatedAt: "2027-03-07",
    note: "Resident agreed to a March 17 source inspection. Leave skirting open only with consent; do not seal before leak route is identified.",
  },
  {
    id: "R-017",
    buildingId: "PS-A",
    area: "Parkside",
    home: "04",
    category: "envelope",
    issue: "Window latch fails to compress seal",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-08",
    updatedAt: "2026-12-08",
    note: "Latch adjusted and seal replaced; resident confirmed closure after rain.",
  },
  {
    id: "R-018",
    buildingId: "PS-A",
    area: "Parkside",
    home: "20",
    category: "leak",
    issue: "Shower waste joint seeps",
    priority: "high",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-10",
    updatedAt: "2027-02-10",
    note: "Waste joint renewed; access arranged with downstairs household for the dry check.",
  },
  {
    id: "R-019",
    buildingId: "PS-B",
    area: "Parkside",
    home: "05",
    category: "ventilation",
    issue: "Shared bathroom duct backflows",
    priority: "high",
    status: "blocked",
    assigneeId: "jon",
    reportedAt: "2026-09-03",
    updatedAt: "2027-03-05",
    note: "Two-home duct inspection awaits the second resident's chosen access date. Temporary ventilation advice offered; household remains in the repair queue.",
  },
  {
    id: "R-020",
    buildingId: "PS-B",
    area: "Parkside",
    home: "08",
    category: "heating",
    issue: "Thermostatic valve stuck closed",
    priority: "high",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-05",
    updatedAt: "2026-11-09",
    note: "Valve freed and tested during heating call; first verified November closure.",
  },
  {
    id: "R-021",
    buildingId: "PS-B",
    area: "Parkside",
    home: "13",
    category: "damp",
    issue: "Bathroom ceiling condensation",
    priority: "routine",
    status: "resolved",
    assigneeId: "jon",
    reportedAt: "2026-09-07",
    updatedAt: "2027-01-12",
    note: "Fan replacement confirmed by resident. This is the fourth January closure; it did not close the separate wet-sill issue in Riverside.",
  },
  {
    id: "R-022",
    buildingId: "PS-B",
    area: "Parkside",
    home: "13",
    category: "envelope",
    issue: "Letterbox flap admits draught",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-11",
    updatedAt: "2027-03-11",
    note: "Flap and internal brush fitted; resident confirmed completion on March 11.",
  },
  {
    id: "R-023",
    buildingId: "HT-A",
    area: "Hilltop",
    home: "03",
    category: "heating",
    issue: "Hall radiator warms intermittently",
    priority: "high",
    status: "scheduled",
    assigneeId: "eli",
    reportedAt: "2026-09-04",
    updatedAt: "2027-03-09",
    note: "Safe temporary heater supplied by agreement. Specialist balancing visit scheduled for March 18; temporary support is not a repair closure.",
  },
  {
    id: "R-024",
    buildingId: "HT-A",
    area: "Hilltop",
    home: "11",
    category: "envelope",
    issue: "Main door perimeter seal split",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-06",
    updatedAt: "2026-10-10",
    note: "Perimeter seal renewed and closer adjusted; resident check complete.",
  },
  {
    id: "R-025",
    buildingId: "HT-A",
    area: "Hilltop",
    home: "11",
    category: "ventilation",
    issue: "Bathroom fan runs without extracting",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-09",
    updatedAt: "2026-12-11",
    note: "Detached duct refitted and airflow confirmed; repair required no new fan.",
  },
  {
    id: "R-026",
    buildingId: "HT-B",
    area: "Hilltop",
    home: "02",
    category: "damp",
    issue: "Ground-floor wall wets after rain",
    priority: "high",
    status: "open",
    assigneeId: "sana",
    reportedAt: "2026-09-02",
    updatedAt: "2027-03-10",
    note: "Rainwater ingress remains under review. Specialist exterior inspection needed; the pilot's seal and fan work cannot resolve this source.",
  },
  {
    id: "R-027",
    buildingId: "HT-B",
    area: "Hilltop",
    home: "06",
    category: "leak",
    issue: "Tap isolation joint drips",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-05",
    updatedAt: "2026-10-11",
    note: "Washer and joint replaced; resident dry check complete.",
  },
  {
    id: "R-028",
    buildingId: "HT-B",
    area: "Hilltop",
    home: "09",
    category: "ventilation",
    issue: "Kitchen extraction duct blocked",
    priority: "high",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-07",
    updatedAt: "2027-01-09",
    note: "Duct cleared and exterior grille repaired; inspected independently of retrofit acceptance.",
  },
  {
    id: "R-029",
    buildingId: "HT-B",
    area: "Hilltop",
    home: "14",
    category: "damp",
    issue: "Utility cupboard floor stays wet",
    priority: "high",
    status: "blocked",
    assigneeId: "sana",
    reportedAt: "2026-09-08",
    updatedAt: "2027-03-06",
    note: "A concealed feed pipe may be involved. Resident requested a revised access plan before opening the cupboard lining; specialist estimate pending.",
  },
  {
    id: "R-030",
    buildingId: "HT-B",
    area: "Hilltop",
    home: "19",
    category: "envelope",
    issue: "Bedroom sash does not close fully",
    priority: "routine",
    status: "resolved",
    assigneeId: "eli",
    reportedAt: "2026-09-11",
    updatedAt: "2027-03-12",
    note: "Sash track repaired and draught strip fitted; final resident confirmation received March 12.",
  },
] satisfies (Omit<RepairItem, "neighborhood" | "assignee" | "hours"> & {
  area: CaseArea;
})[];

export const REPAIR_REGISTER: readonly RepairItem[] = repairRows.map(
  ({ area, ...repair }) => ({
    ...repair,
    neighborhood: area,
    assignee: TEAM.find((member) => member.id === repair.assigneeId)!.name,
    // The common modeled effort, not an assertion about this job's logged time.
    hours: BASELINE.repairHours,
  }),
);

const evidenceNotes = [
  {
    id: "alder-source-intake",
    title: "September repair register",
    date: "2026-09-12",
    authorId: "theo",
    kind: "register",
    summary:
      "Thirty unresolved repair units across 25 homes; the same starting stock used in every comparison.",
    findings: [
      "Riverside: 12 units in 10 homes; Parkside: 10 in 8; Hilltop: 8 in 7. Each area contains 40 homes.",
      "One unit is one scoped repair task, not one resident or one home. A leak and a failed fan in the same home are separate units.",
      "The 30-item register is preserved as a September cohort. Twenty-one are closed by March; nine remain. Newly reported units are tracked separately in monthly balances.",
      "Resident-confirmed closure is required. Temporary safety measures and completed retrofit installations do not automatically close repair units.",
    ],
    limitation:
      "This is an intake register rather than a complete condition survey. Unreported needs and unequal job complexity are not captured by its count.",
    recordIds: ["alder-decision-01", "alder-challenge-06"],
  },
  {
    id: "alder-source-hours",
    title: "Shared rota and time diary",
    date: "2026-10-12",
    authorId: "eli",
    kind: "diary",
    summary:
      "The October rota closed seven units; offered time, useful work and access losses are recorded separately.",
    findings: [
      "The cooperative's modeled pool is 80 offered hours; four opt-in contributors offered up to 16 additional hours. Those commitments are revisited monthly.",
      "The model converts 96 offered hours at 65% productivity into 62.4 productive hours. October's diary recorded 57.5 productive hours: 56 on seven scoped repairs and 1.5 on unresolved diagnosis.",
      "Travel, keys, access and tool collection accounted for 38.5 hours. The observed productive share is about 60%, below the scenario assumption.",
      "Specialist time in later months is funded and logged separately. It is not evidence that the cooperative's pooled hours increased.",
    ],
    limitation:
      "One month's diary cannot establish a stable productive share. The model's eight hours per unit averages tasks that the diary shows are heterogeneous.",
    recordIds: [
      "alder-decision-01",
      "alder-challenge-01",
      "alder-challenge-02",
      "alder-observation-02",
    ],
  },
  {
    id: "alder-source-consent",
    title: "Pilot access register",
    date: "2026-11-18",
    authorId: "maya",
    kind: "minutes",
    summary:
      "Twenty participating homes, four deferrals, and a separate access agreement for each visit.",
    findings: [
      "Eight homes in each area were invited: 24 total. Seven Riverside, six Parkside and seven Hilltop homes opted in: 20 total.",
      "The four deferred homes retain ordinary repair access. Invitations do not establish entry permission; workers confirm dates and scope with each household.",
      "Revised six-month scheduling was reconfirmed after the November review. No participant is obliged to share indoor sensor data.",
      "Leila, Jon and Sana can postpone visits if access conditions are unmet. Volunteer participation never determines repair priority.",
    ],
    limitation:
      "Consent records establish agreed scope and access, not a claim that all residents support the project. Household contact details are excluded from the shared case workspace.",
    recordIds: ["alder-decision-02", "alder-decision-03"],
  },
  {
    id: "alder-source-quote",
    title: "AQ-26-104 materials quote",
    date: "2026-10-13",
    authorId: "theo",
    kind: "invoice",
    summary:
      "£6,240 initial materials cap and £960 contingency; the physical quote is separate from the model's material index.",
    findings: [
      "The quote covers ventilation components, seals, fixings, access consumables and inspection for a maximum 24-home invitation scope.",
      "Only 20 homes opted in. Unused components remain cooperative stock; the approval cap is not a report of actual spend.",
      "Roof membranes, pipe-joint renewal and two heating valves are excluded and remain specialist repair items.",
      "The model's 80 preventive material units are dimensionless. Its total cannot be read as pounds, kit count, carbon or a supplier invoice.",
    ],
    limitation:
      "Budget approval and commitment are known; a final invoice reconciliation is still required at the March review. The model contains no cash-flow or carbon calculation.",
    recordIds: ["alder-challenge-03", "alder-decision-02", "alder-decision-04"],
  },
  {
    id: "alder-source-winter",
    title: "November cold-spell review",
    date: "2026-11-12",
    authorId: "jon",
    kind: "inspection",
    summary:
      "Ten arrivals and only two confirmed closures raised the backlog to 36 and triggered the pilot's pause condition.",
    findings: [
      "Six arrivals were pipe-joint or roof-drainage leaks; four were damp or ventilation reports. Several fall outside the prevention scope.",
      "The previous month ended at 28. The audited balance is 28 + 10 − 2 = 36. A provisional count of 37 remains in the record with its correction.",
      "The four-month comparison predicts 35.4 at month 2, but its 4.5 average arrivals do not describe this cold spell. The similarity of totals does not validate its causes.",
      "The next materials batch was held before the November committee changed the schedule. Urgent safety responses continued while installations paused.",
    ],
    limitation:
      "This event is a warning about averaged arrivals, not an estimate of a climate trend or an evidence-based probability for the stress case.",
    recordIds: [
      "alder-observation-03",
      "alder-observation-04",
      "alder-challenge-05",
      "alder-decision-03",
    ],
  },
  {
    id: "alder-source-scope",
    title: "Retrofit scope and effect review",
    date: "2026-11-18",
    authorId: "leila",
    kind: "review",
    summary:
      "The team reduced the recurrence assumption from 40% to 20%; neither percentage is a measured outcome.",
    findings: [
      "Fans, blocked ducts and failing seals can plausibly reduce some repeat damp work. Roof defects, boilers, pipe joints and rainwater ingress need different interventions.",
      "Four-month scheduling reserves 48 productive hours each month; six-month scheduling reserves 32. Both scenarios require the same 192 retrofit hours.",
      `The six-month comparison activates benefit in month ${evaluate(sixMonth).activationMonth}, predicts ${forecast(sixMonth, 6)} unresolved units at month 6 and ${forecast(sixMonth, 12)} at month 12. It is calculated from September, not from the November backlog.`,
      "No recurrence benefit is claimed before scope completion and inspection. A full-winter comparison, categorized arrivals and independent follow-up are required before expansion.",
      "Twenty participating homes is a scope count. A 20% reduction is a separate, unmeasured scenario input applied across all 120 modeled homes; the small opt-in pilot cannot establish that district-wide effect.",
    ],
    limitation:
      "The percentages are explicit planning assumptions. A small selected opt-in group, changing weather and specialist repairs prevent a causal estimate from the case ledger alone.",
    recordIds: [
      "alder-challenge-04",
      "alder-challenge-05",
      "alder-decision-03",
    ],
  },
  {
    id: "alder-source-inspections",
    title: "March installation inspections",
    date: "2027-03-12",
    authorId: "eli",
    kind: "inspection",
    summary:
      "All 20 participating homes inspected; 192 retrofit hours reconciled. Repair backlog remains a separate measure.",
    findings: [
      "Cumulative retrofit effort: 72 hours in November, 104 in December, 136 in January, 168 in February and 192 in March.",
      "Sixteen homes had accepted final inspections by February; the remaining four were inspected by March 12. No consent group expansion occurred.",
      "Riverside's wet-sill job remains open after a seal patch failed to address its source. Completion of installed work did not create a false repair closure.",
      "No urgent response window was missed in the reviewed period. That safety log does not establish resident comfort, durable performance or a recurrence reduction.",
    ],
    limitation:
      "Installation acceptance checks current workmanship. Durability and winter recurrence need a later visit; inspection totals should not be substituted for repair outcomes.",
    recordIds: [
      "alder-observation-07",
      "alder-observation-08",
      "alder-challenge-07",
      "alder-observation-10",
    ],
  },
  {
    id: "alder-source-march",
    title: "Six-month stock reconciliation",
    date: "2027-03-12",
    authorId: "theo",
    kind: "register",
    summary:
      "Forty unresolved units across 32 homes; expansion stays paused ahead of the March 19 review.",
    findings: [
      "The six-month balance is 30 starting units + 37 newly reported − 27 resident-confirmed closures = 40 unresolved.",
      "Riverside has 17 unresolved units, Parkside 13 and Hilltop 10. Twenty-one original September units closed; nine remain alongside 31 later arrivals.",
      `The selected fixed-baseline comparison predicts ${forecast(sixMonth, 6)} at month 6. The ${number(40 - evaluate(sixMonth).months[6].remaining)}-unit difference is shown as a discrepancy, not silently fitted away.`,
      "The March 10 count of 42 was provisional pending two resident confirmations. The reconciled count of 40 is at the latest decision's hold boundary; no further homes or funds have been authorized.",
    ],
    limitation:
      "The model does not reproduce the actual sequence of rota changes, exceptional winter arrivals or specialist hours. The ledger is a worked case record, not a validation dataset.",
    recordIds: [
      "alder-decision-04",
      "alder-observation-09",
      "alder-observation-10",
    ],
  },
] satisfies (Omit<
  CaseEvidence,
  "author" | "target" | "content" | "finding" | "reference"
> & { findings: string[] })[];

const sourceContext: Record<
  string,
  { target: EvidenceKey; finding: string; reference: string }
> = {
  "alder-source-intake": {
    target: "baseline",
    finding:
      "30 starting units; nine of the September cohort remain open in March.",
    reference: "Repair register AR-2026-09 · R-001–R-030",
  },
  "alder-source-hours": {
    target: "capacity",
    finding: "October used 57.5 productive hours, below the modeled 62.4.",
    reference: "Rota diary AH-2026-10 · countersigned October 12",
  },
  "alder-source-consent": {
    target: "voluntaryHours",
    finding:
      "20 of 24 invited homes opted in; four deferrals retain repair access.",
    reference: "Access register AC-2026-11 · household contacts withheld",
  },
  "alder-source-quote": {
    target: "materials",
    finding:
      "£7,200 envelope approved; material-index units cannot price the pilot.",
    reference: "Supplier quote AQ-26-104 · committee minutes AM-2026-10-15",
  },
  "alder-source-winter": {
    target: "baseline",
    finding:
      "Ten November arrivals crossed the previous 35-unit pause threshold.",
    reference: "Inspection notes AI-2026-11 · November stock reconciliation",
  },
  "alder-source-scope": {
    target: "reductionPercent",
    finding:
      "20% remains an unmeasured assumption; modeled benefit starts in month 7.",
    reference: "Scope review AS-2026-11 · committee minutes AM-2026-11-18",
  },
  "alder-source-inspections": {
    target: "leadMonths",
    finding:
      "192 hours and 20 accepted inspections complete the existing scope.",
    reference: "Installation log AP-2027-03 · final inspection checklist",
  },
  "alder-source-march": {
    target: "baseline",
    finding: "40 unresolved units, 5.8 above the recorded month-6 comparison.",
    reference: "Repair register AR-2027-03 · March 12 reconciliation",
  },
};

export const CASE_EVIDENCE: readonly CaseEvidence[] = evidenceNotes.map(
  ({ findings, ...source }) => ({
    ...source,
    author: TEAM.find((member) => member.id === source.authorId)!.name,
    content: findings,
    ...sourceContext[source.id],
  }),
);

const observationAuthors: Record<string, string> = {
  "alder-observation-01": "leila",
  "alder-observation-02": "theo",
  "alder-observation-03": "jon",
  "alder-observation-04": "eli",
  "alder-observation-05": "sana",
  "alder-observation-06": "leila",
  "alder-observation-07": "theo",
  "alder-observation-08": "maya",
  "alder-observation-09": "jon",
  "alder-observation-10": "theo",
};
const challengeAuthors = ["eli", "sana", "theo", "leila", "jon", "maya", "eli"];
const decisionAuthors = ["eli", "maya", "eli", "maya"];
const decisionTitles = [
  "Shared rota approved",
  "24-home pilot invited",
  "Retrofit schedule revised",
  "Expansion held pending review",
];

/** Stable recorded activity, never simulated online presence or a live feed. */
export const CASE_ACTIVITY: readonly CaseActivity[] = [
  ...decisions.map((decision, index): CaseActivity => ({
    id: `activity-${decision.id}`,
    createdAt: decision.createdAt,
    kind: "decision",
    memberId: decisionAuthors[index],
    title: decisionTitles[index],
    detail: decision.action,
    recordId: decision.id,
  })),
  ...challenges.map((challenge, index): CaseActivity => ({
    id: `activity-${challenge.id}`,
    createdAt: challenge.createdAt,
    kind: "challenge",
    memberId: challengeAuthors[index],
    title: `Questioned ${challenge.target === "voluntaryHours" ? "voluntary hours" : challenge.target === "leadMonths" ? "schedule" : challenge.target === "reductionPercent" ? "recurrence effect" : challenge.target}`,
    detail: challenge.text,
    recordId: challenge.id,
  })),
  ...observations.map((observation): CaseActivity => ({
    id: `activity-${observation.id}`,
    createdAt: observation.createdAt,
    kind: "observation",
    memberId: observationAuthors[observation.id],
    title: `Month ${observation.month}: ${observation.remaining} unresolved`,
    detail: observation.note,
    recordId: observation.id,
  })),
].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
