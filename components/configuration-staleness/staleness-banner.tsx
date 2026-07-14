"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiplierType } from "@/generated/prisma/enums";

interface StaleConfiguration {
  type: MultiplierType;
  label: string;
  updatedAt: string;
  weeksStale: number;
}

interface ConfigurationStalenessData {
  level: "warning" | "danger" | null;
  staleConfigs: StaleConfiguration[];
}

export function ConfigurationStalenessBanner(): React.ReactElement | null {
  const [data, setData] = useState<ConfigurationStalenessData | null>(null);

  const fetchStaleness = useCallback(async () => {
    try {
      const res = await fetch("/api/configuration-staleness");
      if (!res.ok) return;
      const json: ConfigurationStalenessData = await res.json();
      setData(json);
    } catch (error) {
      console.warn("[StalenessBanner] Failed to fetch staleness:", error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStaleness();

    const handler = (): void => {
      void fetchStaleness();
    };
    window.addEventListener("multiplier-config-updated", handler);
    return () => window.removeEventListener("multiplier-config-updated", handler);
  }, [fetchStaleness]);

  if (!data || data.level === null) {
    return null;
  }

  const isDanger = data.level === "danger";

  return (
    <div
      className={cn(
        "px-4 py-3",
        isDanger ? "bg-red-500 text-white" : "bg-amber-500/90 text-black"
      )}
    >
      <div className="max-w-5xl mx-auto flex justify-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">
            {isDanger
              ? "Configuration values are significantly outdated"
              : "Configuration values may be outdated"}
          </p>
        </div>
      </div>
    </div>
  );
}
