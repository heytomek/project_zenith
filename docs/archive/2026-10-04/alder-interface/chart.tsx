"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type Evaluation, type PathwayKind, number } from "@/lib/commons/model";
export const SERIES = ["#818783", "#578395", "#2c6852"];
export function PathwayChart({
  runs,
  selectedKind,
  month,
  observations = [],
  calendar = false,
}: {
  runs: Evaluation[];
  selectedKind?: PathwayKind;
  month?: number;
  observations?: { month: number; remaining: number }[];
  calendar?: boolean;
}) {
  const data = runs[0].months.map((m, index) => ({
    month: m.month,
    current: m.remaining,
    coordinate: runs[1].months[index].remaining,
    prevent: runs[2].months[index].remaining,
    observed: observations.find((o) => o.month === m.month)?.remaining,
  }));
  return (
    <div
      className="model-chart"
      role="img"
      aria-label={`${runs[0].stress ? "Stress case" : "Expected case"}: repair units remaining over twelve months.${observations.length ? " Dark points show recorded observations." : ""} ${month !== undefined ? "Exact values are available in the monthly table below." : "Open Compare for exact monthly values."}`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart
          data={data}
          margin={{ top: 18, right: 20, left: -12, bottom: 4 }}
          accessibilityLayer
        >
          <CartesianGrid stroke="#e4e7e3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "#66716c", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickMargin={12}
            interval="preserveStartEnd"
            tickFormatter={
              calendar
                ? (value) =>
                    new Date(2026, 8 + Number(value), 12).toLocaleDateString(
                      "en-US",
                      { month: "short" },
                    )
                : undefined
            }
          />
          <YAxis
            domain={[0, "auto"]}
            tick={{ fill: "#66716c", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={(label) =>
              calendar
                ? new Date(2026, 8 + Number(label), 12).toLocaleDateString(
                    "en-US",
                    { month: "short", year: "numeric" },
                  )
                : `Month ${label}`
            }
            formatter={(value, name) => [number(Number(value)), name]}
            contentStyle={{
              border: "1px solid #ccd3cc",
              borderRadius: 4,
              fontSize: 13,
              background: "#fbfcf9",
            }}
          />
          {runs[2].activationMonth && (
            <ReferenceLine
              x={runs[2].activationMonth}
              stroke="#a7b9a9"
              strokeDasharray="3 5"
            />
          )}
          {month !== undefined && (
            <ReferenceLine x={month} stroke="#a3aaa4" strokeDasharray="2 3" />
          )}
          {(["current", "coordinate", "prevent"] as const).map((key, i) => (
            <Line
              key={key}
              dataKey={key}
              name={runs[i].pathway.title}
              stroke={SERIES[i]}
              strokeWidth={runs[i].pathway.kind === selectedKind ? 3 : 1.8}
              strokeDasharray={i === 0 ? "5 4" : undefined}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              type="linear"
            />
          ))}
          {observations.length > 0 && (
            <Line
              dataKey="observed"
              name="Recorded"
              stroke="none"
              dot={{ r: 4, fill: "#28352e", stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
