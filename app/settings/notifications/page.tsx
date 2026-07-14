"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppConfig, ConfigField, SaveFooter } from "../_components/shared";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function NotificationsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

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

      toast.success("Notification settings saved");
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);

    try {
      const response = await fetch("/api/test-discord", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send test message");
      }

      toast.success("Test message sent! Check your Discord channel.");
    } catch (error) {
      console.error("Failed to send test message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send test message");
    } finally {
      setTesting(false);
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
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[18px] font-normal text-white tracking-[-0.01em]">
          Discord Notifications
        </h2>
        <div className="flex items-center gap-2">
          <Label className="text-[14px] font-normal text-white tracking-[-0.01em]">
            Enabled
          </Label>
          <Switch
            checked={config.discordEnabled}
            onCheckedChange={(checked) => setConfig({ ...config, discordEnabled: checked })}
          />
        </div>
      </div>

      <div className="space-y-8">
        <ConfigField
          label="Webhook URL"
          name="discordWebhookUrl"
          value={config.discordWebhookUrl}
          onChange={handleChange}
          type="password"
          placeholder="https://discord.com/api/webhooks/..."
          description="Create a webhook in your Discord channel settings"
        />
      </div>

      <div className="pt-8">
        <Button
          onClick={handleTestNotification}
          disabled={testing || !config.discordEnabled}
          variant="outline"
          className="text-[14px]"
        >
          {testing ? "Sending..." : "Send Test Message"}
        </Button>
        <p className="text-[#666666] text-[12px] mt-2">
          Save your settings first, then test the connection
        </p>
      </div>

      <SaveFooter onSave={handleSave} saving={saving} />
    </div>
  );
}
