import { describe, expect, test } from "bun:test";
import {
  ACTIVE_CASE_PATHWAY,
  BUILDINGS,
  CASE_ACTIVITY,
  CASE_EVIDENCE,
  CASE_MONTHS,
  CASE_STUDY,
  CASE_WORKSPACE,
  REPAIR_REGISTER,
  TEAM,
} from "../../apps/web/lib/commons/case-study";
import {
  BASELINE,
  MODEL_VERSION,
  canonical,
  evaluate,
} from "../../apps/web/lib/commons/model";
import {
  exportWorkspace,
  importWorkspace,
  workspaceSchema,
} from "../../apps/web/lib/commons/workspace";

describe("Alder worked case", () => {
  test("the complete fixture satisfies the existing version-one workspace contract", () => {
    expect(workspaceSchema.parse(CASE_WORKSPACE)).toEqual(CASE_WORKSPACE);
    expect(CASE_WORKSPACE.version).toBe(1);
    expect(CASE_WORKSPACE.branches).toHaveLength(4);
    expect(CASE_WORKSPACE.decisions).toHaveLength(4);
    expect(CASE_WORKSPACE.challenges).toHaveLength(7);
    expect(CASE_WORKSPACE.observations).toHaveLength(10);
    expect(CASE_STUDY.homes).toBe(120);
    expect(CASE_STUDY.snapshotDate).toBe("2027-03-12");
    expect(CASE_WORKSPACE.decisions.at(-1)?.id).toBe(
      CASE_STUDY.activeDecisionId,
    );
    expect(CASE_WORKSPACE.decisions.at(-1)?.pathway).toEqual(
      ACTIVE_CASE_PATHWAY,
    );
  });

  test("revisions retain earlier pathways and challenges in chronological order", () => {
    const decisions = CASE_WORKSPACE.decisions;
    expect(decisions[0].parentId).toBeNull();
    for (let index = 1; index < decisions.length; index++) {
      expect(decisions[index].parentId).toBe(decisions[index - 1].id);
      expect(decisions[index].createdAt > decisions[index - 1].createdAt).toBe(
        true,
      );
      expect(decisions[index].challenges.length).toBeGreaterThanOrEqual(
        decisions[index - 1].challenges.length,
      );
    }
    expect(decisions[1].pathway.assumptions).toEqual({
      voluntaryHours: 16,
      leadMonths: 4,
      reductionPercent: 40,
    });
    expect(decisions[2].pathway.assumptions).toEqual({
      voluntaryHours: 16,
      leadMonths: 6,
      reductionPercent: 20,
    });
    expect(decisions[3].reviewDate).toBe(CASE_STUDY.nextReviewDate);
    const copy = structuredClone(CASE_WORKSPACE);
    copy.branches[1].assumptions.reductionPercent = 0;
    copy.challenges[0].text = "Changed after the record was saved";
    expect(copy.decisions[1].pathway.assumptions.reductionPercent).toBe(40);
    expect(copy.decisions[0].challenges[0].text).toBe(
      CASE_WORKSPACE.challenges[0].text,
    );
  });

  test("observations attach to the decision used at the time and retain count corrections", () => {
    for (const observation of CASE_WORKSPACE.observations) {
      const decision = CASE_WORKSPACE.decisions.find(
        (item) => item.id === observation.decisionId,
      )!;
      expect(decision).toBeDefined();
      expect(observation.createdAt > decision.createdAt).toBe(true);
      expect(Number.isInteger(observation.remaining)).toBe(true);
      expect(observation.remaining).not.toBe(
        evaluate(decision.pathway).months[observation.month].remaining,
      );
      expect(observation.note.length).toBeGreaterThan(150);
    }
    const march = CASE_WORKSPACE.observations.filter(
      (observation) => observation.month === 6,
    );
    expect(march.map((observation) => observation.remaining)).toEqual([42, 40]);
    expect(CASE_WORKSPACE.observations.at(-1)?.decisionId).toBe(
      CASE_STUDY.activeDecisionId,
    );
    const forecast = evaluate(ACTIVE_CASE_PATHWAY);
    expect(forecast.months[6].remaining).toBeCloseTo(34.2);
    expect(forecast.remaining).toBeCloseTo(9);
    expect(forecast.activationMonth).toBe(7);
  });

  test("monthly counts conserve the real case stock and keep homes distinct from repair units", () => {
    expect(CASE_MONTHS[0].remaining).toBe(30);
    for (let index = 1; index < CASE_MONTHS.length; index++) {
      const month = CASE_MONTHS[index];
      expect(
        CASE_MONTHS[index - 1].remaining + month.incoming - month.closed,
      ).toBe(month.remaining);
      expect(month.areas.reduce((sum, value) => sum + value, 0)).toBe(
        month.remaining,
      );
      expect(month.affectedHomes).toBeLessThan(month.remaining);
      const finalObservation = CASE_WORKSPACE.observations
        .filter((observation) => observation.month === month.month)
        .at(-1)!;
      expect(finalObservation.remaining).toBe(month.remaining);
    }
    expect(CASE_MONTHS.reduce((sum, month) => sum + month.incoming, 0)).toBe(
      37,
    );
    expect(CASE_MONTHS.reduce((sum, month) => sum + month.closed, 0)).toBe(27);
    expect(CASE_MONTHS.at(-1)?.retrofitHours).toBe(BASELINE.preventionHours);
  });

  test("the September cohort totals agree with the baseline and building/member references", () => {
    expect(REPAIR_REGISTER).toHaveLength(30);
    expect(new Set(REPAIR_REGISTER.map((item) => item.id)).size).toBe(30);
    expect(
      new Set(REPAIR_REGISTER.map((item) => `${item.buildingId}/${item.home}`))
        .size,
    ).toBe(CASE_MONTHS[0].affectedHomes);
    expect(
      REPAIR_REGISTER.filter((item) => item.status === "resolved"),
    ).toHaveLength(21);
    for (const area of BASELINE.neighborhoods) {
      expect(
        REPAIR_REGISTER.filter((item) => item.neighborhood === area.name),
      ).toHaveLength(area.initialNeeds);
      expect(
        BUILDINGS.filter((building) => building.area === area.name).reduce(
          (sum, building) => sum + building.homes,
          0,
        ),
      ).toBe(area.homes);
      expect(
        REPAIR_REGISTER.filter(
          (item) =>
            item.neighborhood === area.name && item.status !== "resolved",
        ),
      ).toHaveLength(3);
      const expectedHomes = { Riverside: 10, Parkside: 8, Hilltop: 7 };
      expect(
        new Set(
          REPAIR_REGISTER.filter((item) => item.neighborhood === area.name).map(
            (item) => `${item.buildingId}/${item.home}`,
          ),
        ).size,
      ).toBe(expectedHomes[area.name]);
    }
    for (const building of BUILDINGS) {
      expect(
        REPAIR_REGISTER.filter((item) => item.buildingId === building.id),
      ).toHaveLength(building.startingRepairs);
      expect(TEAM.some((member) => member.id === building.stewardId)).toBe(
        true,
      );
    }
    for (const repair of REPAIR_REGISTER) {
      expect(
        BUILDINGS.find((building) => building.id === repair.buildingId)?.area,
      ).toBe(repair.neighborhood);
      expect(TEAM.some((member) => member.id === repair.assigneeId)).toBe(true);
      expect(repair.updatedAt <= CASE_STUDY.snapshotDate).toBe(true);
    }
  });

  test("dated cohort closures fit within monthly audited closures", () => {
    let cohortClosed = 0;
    for (let index = 1; index < CASE_MONTHS.length; index++) {
      const month = CASE_MONTHS[index];
      const previousDate = CASE_MONTHS[index - 1].date;
      const closed = REPAIR_REGISTER.filter(
        (repair) =>
          repair.status === "resolved" &&
          repair.updatedAt > previousDate &&
          repair.updatedAt <= month.date,
      ).length;
      expect(closed).toBeLessThanOrEqual(month.closed);
      cohortClosed += closed;
    }
    expect(cohortClosed).toBe(21);
    const allClosed = CASE_MONTHS.reduce((sum, month) => sum + month.closed, 0);
    const laterUnitsClosed = allClosed - cohortClosed;
    const laterUnitsReported = CASE_MONTHS.reduce(
      (sum, month) => sum + month.incoming,
      0,
    );
    expect(laterUnitsClosed).toBe(6);
    expect(30 - cohortClosed + laterUnitsReported - laterUnitsClosed).toBe(40);
  });

  test("source notes and activity point to recorded work, with no generated live presence", () => {
    const records = [
      ...CASE_WORKSPACE.decisions,
      ...CASE_WORKSPACE.challenges,
      ...CASE_WORKSPACE.observations,
    ];
    const ids = new Set(records.map((record) => record.id));
    expect(CASE_EVIDENCE).toHaveLength(8);
    expect(CASE_ACTIVITY).toHaveLength(records.length);
    for (const source of CASE_EVIDENCE) {
      expect(TEAM.some((member) => member.id === source.authorId)).toBe(true);
      expect(source.content.length).toBeGreaterThanOrEqual(4);
      expect(source.limitation.length).toBeGreaterThan(80);
      for (const id of source.recordIds) expect(ids.has(id)).toBe(true);
    }
    for (const event of CASE_ACTIVITY) {
      const record = records.find((item) => item.id === event.recordId)!;
      expect(record).toBeDefined();
      expect(event.createdAt).toBe(record.createdAt);
      expect(TEAM.some((member) => member.id === event.memberId)).toBe(true);
      expect(event.createdAt.slice(0, 10) <= CASE_STUDY.snapshotDate).toBe(
        true,
      );
    }
    expect(CASE_ACTIVITY[0].recordId).toBe("alder-observation-10");
  });

  test("the full case exports and imports with a stable checksum and reproducible model results", async () => {
    const before = canonical({ BASELINE, CASE_WORKSPACE });
    const raw = await exportWorkspace(CASE_WORKSPACE);
    const file = JSON.parse(raw);
    expect(file.modelVersion).toBe(MODEL_VERSION);
    expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(file.results.decisions).toHaveLength(4);
    expect(file.results.decisions.at(-1).expected).toEqual(
      evaluate(ACTIVE_CASE_PATHWAY),
    );
    expect(await importWorkspace(raw)).toEqual(CASE_WORKSPACE);
    expect(await exportWorkspace(CASE_WORKSPACE)).toBe(raw);
    expect(canonical({ BASELINE, CASE_WORKSPACE })).toBe(before);
    file.workspace.observations.at(-1).remaining = 34;
    await expect(importWorkspace(JSON.stringify(file))).rejects.toThrow(
      "checksum",
    );
  });
});
