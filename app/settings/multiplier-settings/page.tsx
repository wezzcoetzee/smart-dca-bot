"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MultiplierType } from "@/generated/prisma/enums";
import { MULTIPLIER_TYPE_LABELS } from "@/lib/configuration-staleness-constants";
import {
  MultiplierConfig,
  MultiplierConfigItem,
  ALL_MULTIPLIER_TYPES,
} from "../_components/shared";

export default function MultiplierSettingsPage() {
  const [multiplierConfigs, setMultiplierConfigs] = useState<MultiplierConfig[]>([]);
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchMultiplierConfigs() {
      try {
        const response = await fetch("/api/multiplier-configuration");
        if (!response.ok) throw new Error("Failed to fetch multiplier configuration");
        const data = await response.json();
        setMultiplierConfigs(data);
      } catch (error) {
        console.error("Failed to fetch multiplier configs:", error);
        toast.error("Failed to load multiplier configuration");
      }
    }
    fetchMultiplierConfigs();
  }, []);

  const handleSaveMultiplier = async (
    type: MultiplierType,
    data: { value: string; multiplier: number; enabled: boolean }
  ) => {
    setSavingStates(prev => ({ ...prev, [type]: true }));

    try {
      const response = await fetch("/api/multiplier-configuration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          value: data.value,
          multiplier: data.multiplier,
          enabled: data.enabled,
        }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || "Failed to save multiplier configuration");
      }

      const updatedConfigs = await fetch("/api/multiplier-configuration").then(r => r.json());
      setMultiplierConfigs(updatedConfigs);
      toast.success(`${MULTIPLIER_TYPE_LABELS[type]} saved`);
    } catch (error) {
      console.error("Failed to save multiplier config:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save multiplier configuration");
    } finally {
      setSavingStates(prev => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div>
      <h2 className="text-[18px] font-normal text-white tracking-[-0.01em] mb-8">
        Multiplier Settings
      </h2>

      <div className="space-y-8">
        {ALL_MULTIPLIER_TYPES.map((type) => {
          const config = multiplierConfigs.find((c) => c.type === type);
          return (
            <MultiplierConfigItem
              key={type}
              config={config}
              onSave={(data) => handleSaveMultiplier(type, data)}
              saving={savingStates[type] || false}
            />
          );
        })}
      </div>
    </div>
  );
}
