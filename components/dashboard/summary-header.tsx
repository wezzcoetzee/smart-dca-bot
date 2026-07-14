"use client";

import type { DashboardSummary } from "@/types/dashboard";

interface SummaryHeaderProps {
  summary: DashboardSummary;
  ticker?: string;
}

export function SummaryHeader({ summary, ticker = "BTC" }: SummaryHeaderProps) {
  const isPositive = summary.percentageDifference >= 0;

  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-sm font-medium tracking-[0.15em] text-white/50 uppercase mb-6">
        {ticker}
      </span>

      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-5xl md:text-7xl font-light text-white tracking-tight">
          $
        </span>
        <span className="text-5xl md:text-7xl font-light text-white tracking-tight tabular-nums">
          {summary.currentPrice.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>

      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          isPositive
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-red-500/10 text-red-500"
        }`}
      >
        <span>
          {isPositive ? "+" : ""}
          {summary.percentageDifference.toFixed(2)}%
        </span>
        <span className="opacity-50">·</span>
        <span className="font-semibold">vs Fixed</span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-center">
        <div>
          <p className="text-xs font-medium tracking-wider text-white/40 uppercase mb-1">
            Programatic
          </p>
          <p className="text-xl font-light text-white tabular-nums">
            $
            {summary.totalProgramaticValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-white/40 mt-0.5 tabular-nums">
            {summary.programaticBtcAmount.toFixed(8)} {ticker}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-white/40 uppercase mb-1">
            Fixed DCA
          </p>
          <p className="text-xl font-light text-white tabular-nums">
            $
            {summary.totalFixedValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-white/40 mt-0.5 tabular-nums">
            {summary.fixedBtcAmount.toFixed(8)} {ticker}
          </p>
        </div>
      </div>
    </div>
  );
}
