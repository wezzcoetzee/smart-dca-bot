"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppConfig, ConfigField, SaveFooter } from "../_components/shared";

export default function StalenessPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch("/api/app-configuration");
        if (!response.ok) throw new Error("Failed to fetch configuration");
        const result = await response.json();
        if (result.success) {
          setConfig(result.data);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to fetch config:", error);
        toast.error("Failed to load configuration");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleChange = (name: keyof AppConfig, value: string | number) => {
    if (!config) return;
    setConfig({ ...config, [name]: value });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);

    try {
      const response = await fetch("/api/app-configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save configuration");

      toast.success("Staleness alert settings saved");
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-[#666666] text-[14px] tracking-[-0.01em]">Loading...</div>;
  }

  if (!config) {
    return <div className="text-[#DC2626] text-[14px] tracking-[-0.01em]">Failed to load configuration</div>;
  }

  return (
    <div>
      <h2 className="text-[18px] font-normal text-white tracking-[-0.01em] mb-8">
        Staleness Alerts
      </h2>

      <div className="space-y-8">
        <ConfigField
          label="Warning Threshold (weeks)"
          name="configWarningWeeks"
          value={config.configWarningWeeks}
          onChange={handleChange}
          type="number"
          description="Show warning if config hasn't been updated in X weeks"
        />
        <ConfigField
          label="Danger Threshold (weeks)"
          name="configDangerWeeks"
          value={config.configDangerWeeks}
          onChange={handleChange}
          type="number"
          description="Show danger alert if config hasn't been updated in X weeks"
        />
      </div>

      <SaveFooter onSave={handleSave} saving={saving} />
    </div>
  );
}
