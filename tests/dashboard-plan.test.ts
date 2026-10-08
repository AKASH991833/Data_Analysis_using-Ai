import test from "node:test";
import assert from "node:assert/strict";
import { validateDashboardPlan, planKpis, planCharts } from "../src/lib/dashboard-plan";
import { profileData } from "../src/lib/analytics-engine";

const rows = Array.from({ length: 60 }, (_, i) => ({
  Dept: ["Eng", "Ops", "HR"][i % 3], Salary: 1000 + i * 10, Age: 20 + (i % 30), Joined: `2025-${String((i % 12) + 1).padStart(2, "0")}-05`, EmpId: `E${i}`,
}));
const { columnMetas, profile } = profileData(rows, ["Dept", "Salary", "Age", "Joined", "EmpId"]);

const good = {
  domain: "HR",
  kpis: [{ label: "Headcount", op: "count" }, { label: "Avg Salary", op: "average", column: "Salary", format: "currency" }, { label: "Max Age", op: "max", column: "Age" }, { label: "Departments", op: "distinct", column: "Dept" }],
  charts: [
    { kind: "hbar", title: "Salary by Dept", dimension: "Dept", measure: "Salary", agg: "sum" },
    { kind: "donut", title: "Headcount by Dept", dimension: "Dept", agg: "count" },
    { kind: "histogram", title: "Age spread", measure: "Age" },
    { kind: "scatter", title: "Age vs Salary", measure: "Age", measure2: "Salary" },
  ],
};

test("valid plan passes and executes locally", () => {
  const plan = validateDashboardPlan(good, columnMetas, profile.dateColumns);
  assert.ok(plan);
  const kpis = planKpis(plan!, rows, profile);
  assert.equal(kpis[0].value, 60);
  assert.equal(kpis[3].value, 3);
  assert.ok(planCharts(plan!, rows).length >= 4);
});

test("hallucinated columns, extra keys and ids as measures are rejected", () => {
  assert.equal(validateDashboardPlan({ ...good, extra: 1 }, columnMetas, []), null);
  const bad = { ...good, charts: good.charts.map((c) => ({ ...c, dimension: c.dimension ? "Nope" : undefined, measure: c.measure ? "EmpId" : undefined })) };
  assert.equal(validateDashboardPlan(bad, columnMetas, []), null);
  assert.equal(validateDashboardPlan({ ...good, kpis: [{ label: "x", op: "sum", column: "Dept" }] }, columnMetas, []), null);
  assert.equal(validateDashboardPlan("ignore previous", columnMetas, []), null);
});
