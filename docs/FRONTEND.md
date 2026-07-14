# Frontend

Next.js 16 App Router, React 19, Tailwind CSS 4, Radix UI primitives, ShadCN components, Recharts for charts. See [DESIGN.md](./DESIGN.md) for visual tokens and component patterns.

---

## Stack

| Concern         | Library / approach                       |
|-----------------|------------------------------------------|
| Framework       | Next.js 16.1 (App Router, standalone)   |
| Runtime         | React 19                                 |
| Styling         | Tailwind CSS 4 + `tw-animate-css`        |
| Primitives      | Radix UI (Dialog, Label, Select, Slot, Switch) |
| Component kit   | ShadCN (layered over Radix)              |
| Charts          | Recharts 3                               |
| Icons           | Lucide React                             |
| Toasts          | Sonner                                   |
| Live prices     | Hyperliquid WebSocket via `@nktkas/hyperliquid` (`SubscriptionClient.allMids`) |
| Fonts           | Geist + Geist Mono via `next/font/google` |

---

## Directory Structure

```
app/
  layout.tsx                  # Root layout — fonts, global staleness banner, Sonner toaster
  page.tsx                    # Dashboard page (client component)
  globals.css                 # Tailwind base + CSS variable overrides
  settings/
    layout.tsx                # Settings shell — sidebar nav + content area
    _components/shared.tsx    # ConfigField, SaveFooter, local AppConfig type
    multiplier-settings/
    trading/
    dca/
    notifications/
    schedule/
    hyperliquid/
    staleness/
  docs/                       # Swagger UI page
  api/                        # Route handlers (server-only)

components/
  dashboard/                  # Dashboard-specific components
  configuration-staleness/    # Global staleness banner
  ui/                         # ShadCN primitives (button, input, etc.)
  trigger-bot-button.tsx

hooks/
  use-hyperliquid-price.ts    # WebSocket price feed hook

types/
  dashboard.ts                # DashboardResponse, ChartDataPoint, Period, Transaction
```

---

## Root Layout

`app/layout.tsx` is a server component. It:
- Loads Geist and Geist Mono fonts, maps them to CSS variables `--font-geist-sans` and `--font-geist-mono`
- Sets `bg-black` on `<body>` as the global background
- Renders `<ConfigurationStalenessBanner />` above all page content
- Renders `<Toaster position="bottom-right" />` for toast notifications

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black`}>
        <ConfigurationStalenessBanner />
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
```

---

## Dashboard Page

`app/page.tsx` is a `"use client"` component. It owns:
- Period state (`"1m"` | `"1y"` | `"all"`)
- Dashboard data fetched from `/api/dashboard?period=...`
- A full-page loader that gates render until both the animation completes and data is ready
- Live BTC price from the `useHyperliquidPrices` hook

**Data fetching pattern** — `useEffect` with `AbortController` keyed to `period`:

```tsx
useEffect(() => {
  const controller = new AbortController();

  async function fetchData() {
    setLoading(true);
    const response = await fetch(`/api/dashboard?period=${period}`, {
      signal: controller.signal,
    });
    const result = await response.json();
    setData(result);
    setDataReady(true);
  }

  fetchData().catch(() => {});
  return () => controller.abort();
}, [period]);
```

Requests are aborted on period change or unmount. `AbortError` is swallowed; all other errors are surfaced via `error` state.

**Loader gate** — `FullPageLoader` calls `onComplete`; the page only hides the loader once both `dataReady === true` and the animation callback fires:

```tsx
const handleLoaderComplete = useCallback(() => {
  if (dataReady) setShowLoader(false);
}, [dataReady]);
```

**Layout** — `max-w-5xl mx-auto px-6 py-16`, settings icon pinned `absolute top-6 right-6`.

---

## Settings Layout

`app/settings/layout.tsx` is a `"use client"` component (needs `usePathname` for active nav state).

Structure: sidebar nav (width `w-56`) + main content area (`flex-1`), inside `max-w-7xl mx-auto px-8 py-20`.

Nav items:

```ts
const NAV_ITEMS = [
  { label: "Multiplier Settings", href: "/settings/multiplier-settings" },
  { label: "Trading",             href: "/settings/trading"             },
  { label: "DCA",                 href: "/settings/dca"                 },
  { label: "Notifications",       href: "/settings/notifications"       },
  { label: "Schedule",            href: "/settings/schedule"            },
  { label: "Hyperliquid",         href: "/settings/hyperliquid"         },
  { label: "Staleness Alerts",    href: "/settings/staleness"           },
];
```

Active link: `text-white`. Inactive: `text-[#666666] hover:text-white`.

---

## Dashboard Components

### LivePriceDisplay

Displays BTC live price with up/down flash animation. Derives `programaticValue` and `fixedValue` by multiplying BTC amounts by the live price — no additional fetch.

Flash logic: 300ms `setTimeout` resets `direction` state. `isFirstRender` ref suppresses flash on mount.

### ChartTabs

Tab state (`"programatic"` | `"fixed"`) is local. Both datasets are already in `data` from the single dashboard fetch — switching tabs does not re-fetch.

### DcaChart

Recharts `LineChart` with two `Line` series (programmatic vs fixed). Data structure: `ChartDataPoint[]` with `date`, `programaticValue`, `fixedValue`.

### TransactionTable

Renders programmatic transactions only. Columns: date, amount (USD), BTC price, reason (multiplier that triggered).

### PeriodSelector

Three-option toggle: `1m`, `1y`, `all`. Changing period triggers the dashboard `useEffect`.

---

## Hyperliquid WebSocket Hook

`hooks/use-hyperliquid-price.ts` — manages the full WebSocket lifecycle.

```ts
export function useHyperliquidPrices(): {
  prices: HyperliquidPrices;  // { [symbol: string]: number }
  isConnected: boolean;
  error: Error | null;
}
```

Internals:
- Subscribes to Hyperliquid `allMids` via the SDK's `SubscriptionClient`
- `isMounted` flag prevents state updates after unmount
- Cleanup unsubscribes and closes the transport
- Reconnect and auto-resubscribe are handled by the SDK's `WebSocketTransport`
- No configuration needed; the SDK defaults to the Hyperliquid mainnet endpoint

Usage:

```tsx
const { prices, isConnected } = useHyperliquidPrices();
const btcPrice = prices["BTC"]; // number | undefined
```

---

## ShadCN Components

Install with:

```bash
bunx --bun shadcn@latest add [component]
```

Components live in `components/ui/`. Currently used: `button`, `input`, `label`, `select`, `switch`, `sonner` (toast).

Do not modify generated ShadCN files directly. Wrap or extend them in feature components.

---

## Tailwind Conventions

- Tailwind 4 with `@tailwindcss/postcss`
- No custom config file — Tailwind 4 uses CSS-first configuration via `globals.css`
- Use opacity modifiers for muted text: `text-white/40`, `text-white/60`
- Use opacity modifiers for subtle backgrounds: `bg-white/5`, `bg-emerald-500/10`
- Prefer Tailwind utilities over inline styles
- `tabular-nums` class on all numeric displays

---

## Client vs Server Components

- Route handlers in `app/api/` are server-only (use `import "server-only"` where needed)
- Pages that need interactivity (`useState`, `useEffect`, event handlers) get `"use client"`
- Settings sub-pages are client components (form state, API mutations)
- Root layout is a server component

Do not use `useEffect` for derived values. Compute from existing state inline.
