"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ChartDataPoint } from "@/types/dashboard";
import { formatShortDateUTC } from "@/lib/date";

interface ValueChartProps {
  data: ChartDataPoint[];
}

interface TooltipPayload {
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload) return null;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-white/50 mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-sm tabular-nums"
          style={{ color: entry.color }}
        >
          {entry.name}: $
          {entry.value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      ))}
    </div>
  );
}

export function ValueChart({ data }: ValueChartProps) {
  const [visibleLines, setVisibleLines] = useState({
    programatic: true,
    fixed: true,
  });

  const handleLegendClick = (dataKey: string) => {
    if (dataKey === "programaticValue") {
      setVisibleLines((prev) => ({ ...prev, programatic: !prev.programatic }));
    } else if (dataKey === "fixedValue") {
      setVisibleLines((prev) => ({ ...prev, fixed: !prev.fixed }));
    }
  };

  const formatYAxis = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatXAxis = (dateStr: string): string => {
    return formatShortDateUTC(dateStr);
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <XAxis
            dataKey="date"
            stroke="#666666"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatXAxis}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#666666"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            onClick={(e) => handleLegendClick(e.dataKey as string)}
            wrapperStyle={{ cursor: "pointer" }}
            formatter={(value: string) => (
              <span className="text-sm text-white/70">{value}</span>
            )}
          />
          {visibleLines.programatic && (
            <Line
              type="monotone"
              dataKey="programaticValue"
              name="Programatic"
              stroke="#FFFFFF"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: "#FFFFFF" }}
            />
          )}
          {visibleLines.fixed && (
            <Line
              type="monotone"
              dataKey="fixedValue"
              name="Fixed DCA"
              stroke="#808080"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: "#808080" }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
