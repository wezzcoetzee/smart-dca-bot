"use client";

import { useEffect, useRef, useState } from "react";
import { PriceTicker } from "./price-ticker";

interface LivePriceDisplayProps {
  price: number | undefined;
  isConnected: boolean;
  programaticBtcAmount: number;
  fixedBtcAmount: number;
  percentageDifference: number;
  ticker?: string;
}

type FlashDirection = "up" | "down" | null;

export function LivePriceDisplay({
  price,
  isConnected,
  programaticBtcAmount,
  fixedBtcAmount,
  percentageDifference,
  ticker = "BTC",
}: LivePriceDisplayProps) {
  const [prevPrice, setPrevPrice] = useState<number>(0);
  const [direction, setDirection] = useState<FlashDirection>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (price === undefined) return;

    if (isFirstRender.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrevPrice(price);
      isFirstRender.current = false;
      return;
    }

    if (price === prevPrice) return;

    if (price > prevPrice) {
      setDirection("up");
    } else {
      setDirection("down");
    }

    const timer = setTimeout(() => {
      setPrevPrice(price);
      setDirection(null);
    }, 300);

    return () => clearTimeout(timer);
  }, [price, prevPrice]);

  const displayPrice = price ?? 0;
  const programaticValue = programaticBtcAmount * displayPrice;
  const fixedValue = fixedBtcAmount * displayPrice;

  const isPositive = percentageDifference >= 0;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm font-medium tracking-[0.15em] text-white/50 uppercase">
          {ticker}
        </span>
        {isConnected ? (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-red-500" />
        )}
      </div>

      <div className="text-5xl md:text-7xl font-light tracking-tight tabular-nums mb-4">
        <PriceTicker
          price={displayPrice}
          prevPrice={prevPrice}
          direction={direction}
        />
      </div>

      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          isPositive
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-red-500/10 text-red-500"
        }`}
      >
        <span>
          {isPositive ? "+" : ""}
          {percentageDifference.toFixed(2)}%
        </span>
        <span className="opacity-50">·</span>
        <span className="font-semibold">vs Fixed</span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-center">
        <div>
          <p className="text-xs font-medium tracking-wider text-white/40 uppercase mb-1">
            Programatic
          </p>
          <p className="text-xl font-light text-white tabular-nums">
            $
            {programaticValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-white/40 mt-0.5 tabular-nums">
            {programaticBtcAmount.toFixed(8)} {ticker}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-white/40 uppercase mb-1">
            Fixed DCA
          </p>
          <p className="text-xl font-light text-white tabular-nums">
            $
            {fixedValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-white/40 mt-0.5 tabular-nums">
            {fixedBtcAmount.toFixed(8)} {ticker}
          </p>
        </div>
      </div>
    </div>
  );
}
