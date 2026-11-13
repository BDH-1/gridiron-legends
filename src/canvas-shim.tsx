import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type { CSSProperties, ReactNode };
export { useCallback, useEffect, useMemo, useRef, useState };

const theme = {
  bg: { subtle: "#0e2233" },
  border: { default: "rgba(255,255,255,0.16)" },
  font: {
    family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    label: { fontSize: 12 },
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  text: { primary: "#eef7fb", secondary: "rgba(238,247,251,0.72)" },
  weight: { semibold: 600 },
};

export function useGrokTheme() {
  return theme;
}

export function Page(p: { title?: string; width?: string; children?: ReactNode }): ReactNode {
  return (
    <main
      style={{
        maxWidth: p.width === "column" ? 760 : 1100,
        margin: "0 auto",
        minHeight: "100dvh",
        boxSizing: "border-box",
        /* Top safe-area is applied on #root so this is regular inset only (avoids double padding). */
        padding: "16px max(14px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-left, 0px))",
        color: theme.text.primary,
        fontFamily: theme.font.family,
      }}
    >
      {p.title ? (
        <h1
          data-gl-title="1"
          style={{
            margin: "0 0 10px",
            fontSize: 32,
            fontWeight: 800,
            fontStyle: "italic",
            letterSpacing: 0.5,
            lineHeight: 1.1,
            textTransform: "uppercase",
            color: theme.text.primary,
          }}
        >
          {p.title}
        </h1>
      ) : null}
      {p.children}
    </main>
  );
}

export function Section(p: { heading?: string; children?: ReactNode }): ReactNode {
  return (
    <section style={{ margin: "18px 0 28px" }}>
      {p.heading ? <h2 style={{ margin: "0 0 10px", fontSize: 20, fontStyle: "italic", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>{p.heading}</h2> : null}
      {p.children}
    </section>
  );
}

export function Text(p: { children?: ReactNode }): ReactNode {
  return <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.45, color: theme.text.secondary }}>{p.children}</p>;
}

export function Button(p: { label: string; onClick?: () => void; variant?: string; disabled?: boolean }): ReactNode {
  const primary = p.variant === "primary";
  return (
    <button
      type="button"
      disabled={p.disabled}
      onClick={p.onClick}
      style={{
        appearance: "none",
        minHeight: 44,
        padding: "8px 14px",
        borderRadius: 10,
        border: primary ? "1px solid #fff3b0" : "1px solid rgba(255,255,255,0.2)",
        background: primary ? "linear-gradient(180deg,#ffe27a,#ffc83a)" : "rgba(255,255,255,0.08)",
        color: primary ? "#2b1a02" : "#eef7fb",
        font: "inherit",
        fontSize: 14,
        fontWeight: 800,
        cursor: p.disabled ? "default" : "pointer",
        opacity: p.disabled ? 0.55 : 1,
        touchAction: "manipulation",
      }}
    >
      {p.label}
    </button>
  );
}

export function Toggle(p: { label: string; value: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
      <input type="checkbox" checked={p.value} onChange={(e) => p.onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
      {p.label}
    </label>
  );
}

export function Input(p: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }): ReactNode {
  return (
    <label style={{ display: "block", flex: "1 1 160px", minWidth: 0, fontSize: 12, fontWeight: 600 }}>
      {p.label ? <div style={{ marginBottom: 4 }}>{p.label}</div> : null}
      <input
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        placeholder={p.placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        style={{ width: "100%", boxSizing: "border-box", minHeight: 40, padding: "8px 10px", borderRadius: 8, border: "1px solid " + theme.border.default, background: theme.bg.subtle, color: theme.text.primary, font: "inherit" }}
      />
    </label>
  );
}

export function Select(p: { label?: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }): ReactNode {
  return (
    <label style={{ display: "block", flex: "1 1 140px", minWidth: 0, fontSize: 12, fontWeight: 600 }}>
      {p.label ? <div style={{ marginBottom: 4 }}>{p.label}</div> : null}
      <select
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        style={{ width: "100%", minHeight: 40, padding: "8px 10px", borderRadius: 8, border: "1px solid " + theme.border.default, background: theme.bg.subtle, color: theme.text.primary, font: "inherit" }}
      >
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Table(p: { columns: string[]; rows: string[][]; align?: string[] }): ReactNode {
  return (
    <div style={{ overflowX: "auto", margin: "8px 0 14px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {p.columns.map((c, i) => (
              <th key={c} style={{ textAlign: (p.align?.[i] as "left" | "right" | "center") || "left", padding: "6px 8px", borderBottom: "1px solid " + theme.border.default }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} style={{ textAlign: (p.align?.[ci] as "left" | "right" | "center") || "left", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Metrics(p: { metrics: { value: string; label: string; detail?: string }[] }): ReactNode {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, margin: "10px 0 14px" }}>
      {p.metrics.map((m) => (
        <div key={m.label} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{m.value}</div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.75, marginTop: 4 }}>{m.label}</div>
          {m.detail ? <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3, lineHeight: 1.3 }}>{m.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function Pie(p: { parts: { label: string; value: number; display?: string }[]; total: number; label?: string }): ReactNode {
  const sum = p.parts.reduce((n, x) => n + x.value, 0) || 1;
  let acc = 0;
  const stops = p.parts.map((part, i) => {
    const hues = [42, 160, 200, 280, 12, 90, 320, 230, 50];
    const a = (acc / sum) * 360;
    acc += part.value;
    const b = (acc / sum) * 360;
    return `hsl(${hues[i % hues.length]} 70% 50%) ${a}deg ${b}deg`;
  });
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "8px 0 14px" }}>
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(${stops.join(", ")})`, flexShrink: 0 }} aria-label={p.label} />
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        {p.label ? <div style={{ fontWeight: 800, marginBottom: 4 }}>{p.label}</div> : null}
        {p.parts.map((part) => (
          <div key={part.label}>{part.label}: {part.display ?? String(part.value)}</div>
        ))}
      </div>
    </div>
  );
}

export function Callout(p: { tone?: string; lead?: string; children?: ReactNode }): ReactNode {
  const warn = p.tone === "warning";
  return (
    <div style={{ margin: "10px 0", padding: "12px 14px", borderRadius: 12, background: warn ? "rgba(90,30,0,0.55)" : "rgba(255,255,255,0.06)", border: warn ? "1px solid rgba(255,180,80,0.55)" : "1px solid rgba(255,255,255,0.1)", color: warn ? "#ffe9c8" : theme.text.primary }}>
      {p.lead ? <div style={{ fontWeight: 800, marginBottom: 6 }}>{p.lead}</div> : null}
      {p.children}
    </div>
  );
}

export function Divider(): ReactNode {
  return <hr style={{ border: "none", borderTop: "1px solid " + theme.border.default, margin: "16px 0" }} />;
}

export function Floating(p: { edge?: string; align?: string; children?: ReactNode }): ReactNode {
  const style: CSSProperties = { position: "fixed", zIndex: 80, pointerEvents: "none", padding: 12 };
  if (p.edge === "top") style.top = "max(10px, env(safe-area-inset-top))";
  else style.bottom = "max(10px, env(safe-area-inset-bottom))";
  if (p.align === "center") {
    style.left = "50%";
    style.transform = "translateX(-50%)";
  } else if (p.align === "start") style.left = "max(10px, env(safe-area-inset-left))";
  else style.right = "max(10px, env(safe-area-inset-right))";
  return (
    <div style={style}>
      <div style={{ pointerEvents: "auto" }}>{p.children}</div>
    </div>
  );
}

export function BackToTop(): ReactNode {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const fn = (): void => setOn(window.scrollY > 400);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  if (!on) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      style={{
        position: "fixed",
        right: "max(12px, env(safe-area-inset-right))",
        bottom: "max(56px, calc(env(safe-area-inset-bottom) + 48px))",
        zIndex: 70,
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "1px solid rgba(255,226,122,0.5)",
        background: "#0b2447",
        color: "#ffe27a",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      ↑
    </button>
  );
}
