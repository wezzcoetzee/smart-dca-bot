"use client";

import { useState, useEffect, useCallback } from "react";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { LivePriceDisplay } from "@/components/dashboard/live-price-display";
import { ChartTabs } from "@/components/dashboard/chart-tabs";
import { TransactionTable } from "@/components/dashboard/transaction-table";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { FullPageLoader } from "@/components/dashboard/full-page-loader";
import { useHyperliquidPrices } from "@/hooks/use-hyperliquid-price";
import Link from "next/link";
import { Bot } from "lucide-react";
import { TriggerBotButton } from "@/components/trigger-bot-button";
import type { Period, DashboardResponse } from "@/types/dashboard";

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("1m");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [showLoader, setShowLoader] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { prices, isConnected } = useHyperliquidPrices();

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/dashboard?period=${period}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        const result = await response.json();
        setData(result);
        setDataReady(true);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => controller.abort();
  }, [period]);

  const livePrice = prices["BTC"];

  const handleLoaderComplete = useCallback(() => {
    if (dataReady) {
      setShowLoader(false);
    }
  }, [dataReady]);

  if (showLoader) {
    return <FullPageLoader onComplete={handleLoaderComplete} />;
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-5xl mx-auto px-6 py-16 relative">
        <div className="absolute top-6 right-6 flex items-center gap-4">
          <TriggerBotButton />
          <Link
            href="/settings"
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <Bot size={20} />
          </Link>
        </div>

        <LivePriceDisplay
          price={livePrice}
          isConnected={isConnected}
          programaticBtcAmount={data?.summary.programaticBtcAmount ?? 0}
          fixedBtcAmount={data?.summary.fixedBtcAmount ?? 0}
          percentageDifference={data?.summary.percentageDifference ?? 0}
        />

        <div className="flex justify-center mt-12 mb-12">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        {loading && <DashboardSkeleton />}

        {error && (
          <div className="flex items-center justify-center py-32">
            <div className="text-red-500 text-sm">{error}</div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div>
              <ChartTabs data={data.chartData} />
            </div>

            <div className="mt-16">
              <h2 className="text-sm font-medium tracking-wider text-white/40 uppercase mb-4">
                Programatic Transactions
              </h2>
              <TransactionTable transactions={data.transactions} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
