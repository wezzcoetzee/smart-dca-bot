"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ChartDataPoint } from "@/types/dashboard";
import { formatShortDateUTC } from "@/lib/date";

type DcaVariant = "programatic" | "fixed";

interface DcaChartProps {
  data: ChartDataPoint[];
  variant: DcaVariant;
}

interface TooltipPayload {
  color: string;
  name: string;
  value: number;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

type LineKey = "value" | "spent" | "btc";

const LINE_CONFIG = {
  programatic: {
    value: { key: "programaticValue", label: "Portfolio Value", color: "#FFFFFF" },
    spent: { key: "programaticSpent", label: "Amount Spent", color: "#808080" },
    btc: { key: "programaticBtcAccumulated", label: "BTC Accumulated", color: "#F7931A" },
  },
  fixed: {
    value: { key: "fixedValue", label: "Portfolio Value", color: "#FFFFFF" },
    spent: { key: "fixedSpent", label: "Amount Spent", color: "#808080" },
    btc: { key: "fixedBtcAccumulated", label: "BTC Accumulated", color: "#F7931A" },
  },
} as const;

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload) return null;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-white/50 mb-1">{label}</p>
      {payload.map((entry, index) => {
        const isBtc = entry.dataKey.includes("BtcAccumulated");
        return (
          <p
            key={index}
            className="text-sm tabular-nums"
            style={{ color: entry.color }}
          >
            {entry.name}:{" "}
            {isBtc
              ? `${entry.value.toFixed(8)} BTC`
              : `$${entry.value.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </p>
        );
      })}
    </div>
  );
}

export function DcaChart({ data, variant }: DcaChartProps) {
  const [visibleLines, setVisibleLines] = useState<Record<LineKey, boolean>>({
    value: true,
    spent: true,
    btc: true,
  });

  const config = LINE_CONFIG[variant];

  const toggleLine = (key: LineKey) => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatYAxis = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatBtcAxis = (value: number): string => {
    if (value >= 1) return `${value.toFixed(2)}`;
    if (value >= 0.01) return `${value.toFixed(4)}`;
    return `${value.toFixed(6)}`;
  };

  const formatXAxis = (dateStr: string): string => {
    return formatShortDateUTC(dateStr);
  };

  return (
    <div className="w-full">
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 60, bottom: 20, left: 20 }}
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
              yAxisId="usd"
              stroke="#666666"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              width={60}
            />
            <YAxis
              yAxisId="btc"
              orientation="right"
              stroke="#F7931A"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatBtcAxis}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              yAxisId="usd"
              type="monotone"
              dataKey={config.value.key}
              name={config.value.label}
              stroke={config.value.color}
              strokeWidth={1.5}
              strokeOpacity={visibleLines.value ? 1 : 0}
              dot={false}
              activeDot={visibleLines.value ? { r: 4, fill: config.value.color } : false}
            />
            <Line
              yAxisId="usd"
              type="monotone"
              dataKey={config.spent.key}
              name={config.spent.label}
              stroke={config.spent.color}
              strokeWidth={1.5}
              strokeOpacity={visibleLines.spent ? 1 : 0}
              dot={false}
              activeDot={visibleLines.spent ? { r: 4, fill: config.spent.color } : false}
            />
            <Line
              yAxisId="btc"
              type="monotone"
              dataKey={config.btc.key}
              name={config.btc.label}
              stroke={config.btc.color}
              strokeWidth={1.5}
              strokeOpacity={visibleLines.btc ? 1 : 0}
              dot={false}
              activeDot={visibleLines.btc ? { r: 4, fill: config.btc.color } : false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 mt-4">
        {(Object.keys(config) as LineKey[]).map((key) => {
          const { label, color } = config[key];
          const isVisible = visibleLines[key];
          return (
            <button
              key={key}
              onClick={() => toggleLine(key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-opacity ${
                isVisible ? "opacity-100" : "opacity-40"
              }`}
            >
              <span
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-white/70">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
