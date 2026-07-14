"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function Spinner() {
  return (
    <svg
      className="animate-spin size-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function TriggerBotButton() {
  const [triggering, setTriggering] = useState(false);

  const handleTriggerCron = async () => {
    setTriggering(true);

    try {
      const response = await fetch("/api/trigger-bot", { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to trigger bot");
      }

      toast.success(
        `Bot executed: $${data.amount.toFixed(2)} - ${data.reason}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to trigger bot";
      toast.error(errorMessage);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <Button
      onClick={handleTriggerCron}
      disabled={triggering}
      className="bg-white text-black hover:bg-[#e5e5e5] text-[11px] tracking-[0.08em] uppercase font-medium h-auto px-4 py-2 rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {triggering ? (
        <>
          <Spinner />
          <span>Running...</span>
        </>
      ) : (
        "Trigger Bot"
      )}
    </Button>
  );
}
