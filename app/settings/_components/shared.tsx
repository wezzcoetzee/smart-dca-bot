"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, CircleOff, Eye, EyeOff } from "lucide-react";
import { MultiplierType } from "@/generated/prisma/enums";
import { formatLongDateUTC } from "@/lib/date";
import { MULTIPLIER_TYPE_LABELS, getStalenessLevel } from "@/lib/configuration-staleness-constants";

export interface AppConfig {
  baseAmountToPurchase: number;
  hyperliquidSymbol: string;
  lowBalanceThreshold: number;
  cronSecret: string;
  discordWebhookUrl: string;
  discordEnabled: boolean;
  configWarningWeeks: number;
  configDangerWeeks: number;
  hyperliquidPrivateKey: string;
  hyperliquidWalletAddress: string;
  hyperliquidKeyCreatedDate: string | null;
}

export interface MultiplierConfig {
  id: string;
  type: MultiplierType;
  value: string;
  multiplier: number;
  enabled: boolean;
  updatedAt: string;
}

export const ALL_MULTIPLIER_TYPES = Object.values(MultiplierType);

export function MessageBanner({
  message,
}: {
  message: { type: "success" | "error"; text: string } | null;
}) {
  if (!message) return null;

  return (
    <div
      className={`mb-12 px-4 py-3 border ${message.type === "success"
          ? "border-[#10B981] text-[#10B981]"
          : "border-[#DC2626] text-[#DC2626]"
        } text-[12px] tracking-[0.02em]`}
    >
      {message.text}
    </div>
  );
}

export function ConfigField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  description,
  readOnly,
  suffix,
}: {
  label: string;
  name: keyof AppConfig;
  value: string | number;
  onChange: (name: keyof AppConfig, value: string | number) => void;
  type?: "text" | "number" | "password";
  placeholder?: string;
  description?: string;
  readOnly?: boolean;
  suffix?: React.ReactNode;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password";
  const inputType = isPasswordField && !showPassword ? "password" : isPasswordField ? "text" : type;

  return (
    <div className="grid gap-3">
      <Label
        htmlFor={name}
        className="text-[14px] font-normal text-white tracking-[-0.01em]"
      >
        {label}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={name}
            type={inputType}
            value={value}
            onChange={(e) => onChange(name, type === "number" ? Number(e.target.value) : e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className={`
              bg-black
              border border-[#404040]
              text-white
              placeholder:text-[#404040]
              focus:border-white
              focus-visible:ring-0
              focus-visible:ring-offset-0
              rounded-sm
              h-11
              px-4
              transition-colors
              ${type === "number" ? "tabular-nums" : ""}
              ${isPasswordField ? "pr-12" : ""}
              ${readOnly ? "text-[#808080] cursor-not-allowed" : ""}
            `}
          />
          {isPasswordField && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666666] hover:text-white transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {suffix}
      </div>
      {description && (
        <p className="text-[11px] text-[#666666] leading-relaxed">{description}</p>
      )}
    </div>
  );
}

export function MultiplierConfigItem({
  config,
  onSave,
  saving,
}: {
  config: MultiplierConfig | undefined;
  onSave: (data: { value: string; multiplier: number; enabled: boolean }) => Promise<void>;
  saving: boolean;
}) {
  const [multiplierValue, setMultiplierValue] = useState(config?.value || "");
  const [multiplier, setMultiplier] = useState(config?.multiplier.toString() || "");
  const [multiplierEnabled, setMultiplierEnabled] = useState(config?.enabled ?? true);

  useEffect(() => {
    if (config) {
      // Sync form state with config prop
      setMultiplierValue(config.value);
      setMultiplier(config.multiplier.toString());
      setMultiplierEnabled(config.enabled);
    }
    // Only re-sync when config ID changes (switching between different configs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.id]);

  const handleSave = async () => {
    const multiplierNum = parseFloat(multiplier);
    if (isNaN(multiplierNum)) {
      return;
    }
    await onSave({
      value: multiplierValue,
      multiplier: multiplierNum,
      enabled: multiplierEnabled,
    });
  };

  const isDisabled = config && !config.enabled;
  const staleness = config && config.enabled ? getStalenessLevel(config.updatedAt, config.type, 1, 2) : null;
  const typeName = config ? MULTIPLIER_TYPE_LABELS[config.type] : "";

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[14px] font-normal tracking-[-0.01em] ${isDisabled ? "text-white/40" : "text-white"}`}>
            {typeName}
          </span>
          {isDisabled && <CircleOff className="h-4 w-4 text-white/40" />}
          {staleness && (
            <AlertTriangle
              className={
                staleness === "danger"
                  ? "h-4 w-4 text-red-500"
                  : "h-4 w-4 text-amber-500"
              }
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[14px] font-normal text-white tracking-[-0.01em]">
            Enabled
          </Label>
          <Switch checked={multiplierEnabled} onCheckedChange={setMultiplierEnabled} />
        </div>
      </div>

      {multiplierValue !== "EXTERNALLY_SET" && (
        <div className="grid gap-3">
          <Label className="text-[14px] font-normal text-white tracking-[-0.01em]">
            Value
          </Label>
          <Input
            value={multiplierValue}
            onChange={(e) => setMultiplierValue(e.target.value)}
            className="bg-black border border-[#404040] text-white placeholder:text-[#404040] focus:border-white focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm h-11 px-4 transition-colors"
          />
        </div>
      )}

      <div className="grid gap-3">
        <Label className="text-[14px] font-normal text-white tracking-[-0.01em]">
          Multiplier
        </Label>
        <Input
          type="number"
          step="0.01"
          value={multiplier}
          onChange={(e) => setMultiplier(e.target.value)}
          className="bg-black border border-[#404040] text-white placeholder:text-[#404040] focus:border-white focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm h-11 px-4 transition-colors tabular-nums"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-[#666666]">
          {config ? `Last updated: ${formatLongDateUTC(config.updatedAt)}` : ""}
        </span>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-white text-black hover:bg-[#f5f5f5] text-[12px] tracking-[0.05em] uppercase font-medium h-auto px-6 py-2 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Multiplier"}
        </Button>
      </div>
    </div>
  );
}

export function SaveFooter({
  onSave,
  saving,
  onCancel,
}: {
  onSave: () => void;
  saving: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex justify-end gap-6 mt-20 pt-12 border-t border-[#404040]">
      {onCancel && (
        <Button
          onClick={onCancel}
          variant="ghost"
          className="text-[#808080] hover:text-white hover:bg-transparent text-[12px] tracking-[0.05em] uppercase font-medium h-auto px-0 py-2 transition-colors"
        >
          Cancel
        </Button>
      )}
      <Button
        onClick={onSave}
        disabled={saving}
        className="bg-white text-black hover:bg-[#f5f5f5] text-[12px] tracking-[0.05em] uppercase font-medium h-auto px-6 py-2 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
