"use client";

import { useState, useEffect } from "react";
import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";

export interface HyperliquidPrices {
    [symbol: string]: number;
}

interface UseHyperliquidPricesReturn {
    prices: HyperliquidPrices;
    isConnected: boolean;
    error: Error | null;
}

type Subscription = { unsubscribe: () => Promise<unknown> };

export function useHyperliquidPrices(): UseHyperliquidPricesReturn {
    const [prices, setPrices] = useState<HyperliquidPrices>({});
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;
        let subscription: Subscription | null = null;

        const transport = new WebSocketTransport();
        const client = new SubscriptionClient({ transport });

        client
            .allMids((data) => {
                if (!isMounted) return;
                const next: HyperliquidPrices = {};
                for (const [symbol, price] of Object.entries(data.mids)) {
                    next[symbol] = parseFloat(price);
                }
                setPrices(next);
                setIsConnected(true);
                setError(null);
            })
            .then((sub) => {
                if (!isMounted) {
                    void sub.unsubscribe();
                    return;
                }
                subscription = sub;
                setIsConnected(true);
            })
            .catch((cause) => {
                if (!isMounted) return;
                setIsConnected(false);
                setError(new Error("Hyperliquid WebSocket error", { cause }));
            });

        return () => {
            isMounted = false;
            void subscription?.unsubscribe().catch(() => {});
            void transport.close().catch(() => {});
        };
    }, []);

    return { prices, isConnected, error };
}
