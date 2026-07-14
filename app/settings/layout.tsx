"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Multiplier Settings", href: "/settings/multiplier-settings" },
  { label: "Trading", href: "/settings/trading" },
  { label: "DCA", href: "/settings/dca" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Schedule", href: "/settings/schedule" },
  { label: "Hyperliquid", href: "/settings/hyperliquid" },
  { label: "Staleness Alerts", href: "/settings/staleness" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#000000]">
      <div className="max-w-7xl mx-auto px-8 py-20">
        <div className="flex items-start justify-between mb-20">
          <div>
            <h1 className="text-[32px] font-normal text-white tracking-[-0.02em] mb-2">
              Configuration
            </h1>
            <p className="text-[#666666] text-[14px] tracking-[-0.01em]">
              System parameters
            </p>
          </div>
          <Link href="/">
            <Button
              variant="ghost"
              className="text-[#808080] hover:text-white hover:bg-transparent text-[12px] tracking-[0.05em] uppercase font-medium h-auto p-0 transition-colors"
            >
              ← Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex gap-20">
          <nav className="w-56 flex-shrink-0">
            <ul className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        block text-[14px] tracking-[-0.01em] py-2 transition-colors
                        ${isActive
                          ? "text-white font-normal"
                          : "text-[#666666] hover:text-white font-normal"
                        }
                      `}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
