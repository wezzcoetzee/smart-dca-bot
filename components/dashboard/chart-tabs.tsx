"use client";

import { useState } from "react";
import { DcaChart } from "./dca-chart";
import type { ChartDataPoint } from "@/types/dashboard";

type TabVariant = "programatic" | "fixed";

interface ChartTabsProps {
  data: ChartDataPoint[];
}

const TABS: { key: TabVariant; label: string }[] = [
  { key: "programatic", label: "Programmatic DCA" },
  { key: "fixed", label: "Fixed DCA" },
];

export function ChartTabs({ data }: ChartTabsProps) {
  const [activeTab, setActiveTab] = useState<TabVariant>("programatic");

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-black"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DcaChart data={data} variant={activeTab} />
    </div>
  );
}
