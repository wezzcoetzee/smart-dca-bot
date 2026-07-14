"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppConfig, ConfigField, SaveFooter } from "../_components/shared";

export default function HyperliquidPage() {
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
        body: JSON.stringify({
          hyperliquidPrivateKey: config.hyperliquidPrivateKey,
          hyperliquidWalletAddress: config.hyperliquidWalletAddress,
          hyperliquidKeyCreatedDate: config.hyperliquidKeyCreatedDate,
        }),
      });
      if (!response.ok) throw new Error("Failed to save configuration");
      toast.success("Hyperliquid configuration saved");
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
        Hyperliquid
      </h2>
      <div className="space-y-8">
        <ConfigField
          label="API Private Key"
          name="hyperliquidPrivateKey"
          value={config.hyperliquidPrivateKey ?? ""}
          onChange={handleChange}
          type="password"
          placeholder="0x..."
          description="API wallet private key from app.hyperliquid.xyz/API. Encrypted at rest."
        />
        <ConfigField
          label="Wallet Address"
          name="hyperliquidWalletAddress"
          value={config.hyperliquidWalletAddress ?? ""}
          onChange={handleChange}
          type="text"
          placeholder="0x..."
          description="Your master wallet address (used for balance queries)"
        />
        <div className="space-y-2">
          <label className="text-[14px] font-normal text-white tracking-[-0.01em]">
            Key Created Date
          </label>
          <input
            type="date"
            value={config.hyperliquidKeyCreatedDate?.split("T")[0] ?? ""}
            onChange={(e) =>
              handleChange("hyperliquidKeyCreatedDate" as keyof AppConfig, e.target.value || "")
            }
            className="bg-black border border-[#404040] text-white focus:border-white focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm h-11 px-4 transition-colors w-full block"
          />
          <p className="text-[11px] text-[#666666] leading-relaxed">
            When this API key was generated. Keys expire after 180 days.
          </p>
        </div>
      </div>
      <SaveFooter onSave={handleSave} saving={saving} />
    </div>
  );
}
