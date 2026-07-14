"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/multiplier-settings");
  }, [router]);

  return (
    <div className="text-[#666666] text-[14px] tracking-[-0.01em]">
      Redirecting...
    </div>
  );
}
