# Design System

Aesthetic direction: **Refined Financial Minimalism**. Pure black backgrounds, clinical white text, color reserved exclusively for semantic price movement. Every pixel serves data.

See [FRONTEND.md](./FRONTEND.md) for component conventions and how these tokens are applied.

---

## Color Palette

```css
:root {
  /* Backgrounds */
  --bg-primary: #000000;

  /* Foreground */
  --fg-primary:   #FFFFFF;
  --fg-secondary: #808080;
  --fg-tertiary:  #404040;

  /* Semantic — only use color for price movement */
  --color-negative:    #DC2626;
  --color-negative-bg: rgba(220, 38, 38, 0.1);
  --color-positive:    #10B981;
  --color-positive-bg: rgba(16, 185, 129, 0.1);

  /* Charts */
  --chart-line:       #FFFFFF;
  --chart-grid:       rgba(255, 255, 255, 0.05);
  --chart-axis-label: #666666;
}
```

**Rules:**
- No gray backgrounds — only `#000000`
- No borders, box shadows, or gradients
- Red (`#DC2626`) means negative/down only
- Green (`#10B981`) means positive/up only

---

## Typography

```css
:root {
  --font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  --font-body:    -apple-system, BlinkMacSystemFont, 'SF Pro Text',    'Segoe UI', sans-serif;
  --font-mono:    'SF Mono', 'Consolas', monospace;

  /* Scale */
  --text-xs:      0.6875rem; /* 11px — axis labels */
  --text-sm:      0.75rem;   /* 12px — ticker symbols */
  --text-base:    0.875rem;  /* 14px — badge text */
  --text-lg:      1rem;      /* 16px */
  --text-display: 4.5rem;    /* 72px — hero price */

  /* Weights */
  --weight-normal:   400;
  --weight-medium:   500;
  --weight-semibold: 600;
  --weight-bold:     700;

  /* Tracking */
  --tracking-tight:  -0.02em;
  --tracking-normal:  0;
  --tracking-wide:    0.05em;
  --tracking-wider:   0.15em;
}
```

The actual codebase uses **Geist** (via `next/font/google`) mapped to `--font-geist-sans` and `--font-geist-mono` in the root layout. These override the system font stack above for production use.

**Typography hierarchy:**
- Hero price display: 72px (`text-7xl`), `font-light`, `tracking-tight`, `tabular-nums`
- Section labels: 12px, `tracking-wider`, `uppercase`, `text-white/40`
- Body / table text: 14px, `font-normal`
- Axis labels: 11px, `#666666`

Always use `tabular-nums` / `font-variant-numeric: tabular-nums` on all numeric displays so digits do not shift width as values update.

---

## Spacing

4px base grid. Tailwind utility classes are preferred over custom properties in component code.

```css
:root {
  --space-1:  0.25rem;  /*  4px */
  --space-2:  0.5rem;   /*  8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
}
```

Target 80% empty space on any given screen. Negative space is intentional, not a gap to fill.

---

## Border Radius

```css
:root {
  --radius-sm:   0.25rem;  /*   4px */
  --radius-md:   0.375rem; /*   6px */
  --radius-lg:   0.5rem;   /*   8px */
  --radius-full: 9999px;   /* pills */
}
```

Pill shape (`rounded-full`) is used for change-indicator badges and tab selectors.

---

## Responsive Breakpoints

| Breakpoint | Width      | Price display | Chart height |
|------------|------------|---------------|--------------|
| Mobile     | ≤ 768px    | 48px (3rem)   | 300px        |
| Tablet     | 769–1024px | 60px (3.75rem)| 350px        |
| Desktop    | > 1024px   | 72px (4.5rem) | 400px        |

In Tailwind: `text-5xl md:text-7xl` on the hero price, `max-w-5xl` content container on the dashboard, `max-w-7xl` on settings.

---

## Component Patterns

### Price badge (change indicator)

Pill shape, semantic background at 10% opacity, matching text color.

```tsx
<div
  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
    isPositive
      ? "bg-emerald-500/10 text-emerald-500"
      : "bg-red-500/10 text-red-500"
  }`}
>
  <span>{isPositive ? "+" : ""}{value.toFixed(2)}%</span>
  <span className="opacity-50">·</span>
  <span className="font-semibold">{label}</span>
</div>
```

### Tab selector

Active state: solid white fill with black text. Inactive: `bg-white/5` with muted text.

```tsx
<button
  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
    isActive
      ? "bg-white text-black"
      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
  }`}
>
  {label}
</button>
```

### Section labels

```tsx
<h2 className="text-sm font-medium tracking-wider text-white/40 uppercase mb-4">
  Label
</h2>
```

### Navigation links (settings sidebar)

```tsx
<Link
  className={`block text-[14px] tracking-[-0.01em] py-2 transition-colors ${
    isActive ? "text-white font-normal" : "text-[#666666] hover:text-white font-normal"
  }`}
>
```

### Connection status indicator

```tsx
{isConnected
  ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
  : <span className="w-2 h-2 rounded-full bg-red-500" />
}
```

---

## Animation

Price flash on WebSocket tick: 300ms timeout, direction state (`"up"` | `"down"` | `null`), color class applied transiently.

Chart line entrance: `stroke-dasharray` draw animation over 2s on load.

Keep motion subtle. This is a data tool, not a marketing page.

---

## Accessibility

- Wrap price regions in `<article>` with `aria-label`
- `aria-hidden="true"` on decorative currency symbols (`$`)
- Provide `aria-label` describing direction on change badges
- Charts rendered as `role="img"` with descriptive `aria-label`
