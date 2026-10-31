"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export type PickerOption<V extends string | number = string> = {
  value: V;
  label: string;
  /** Second line (e.g. the town). */
  sub?: string;
  /** Initials badge, e.g. { text: "MH", color: "#3f7a4f" }. */
  badge?: { text: string; color: string };
  /** Small terracotta pill on the right (e.g. "2 arriving today"). */
  tag?: string;
  /** Leading glyph (emoji) when there's no badge. */
  icon?: ReactNode;
};

const SEARCH_MIN = 7; // search shows when there are more than 6 options (or search=true)
const DESKTOP = "(min-width: 768px)";

function useDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => { const m = matchMedia(DESKTOP); const f = () => setD(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return d;
}

const Badge = ({ o }: { o: PickerOption<string | number> }) =>
  o.badge ? <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[10px] text-xs font-bold text-white" style={{ background: o.badge.color }}>{o.badge.text}</span>
  : o.icon ? <span aria-hidden className="grid size-8 shrink-0 place-items-center text-lg">{o.icon}</span> : null;

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded-[3px] bg-[#b66243]/20 text-inherit">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/**
 * Searchable picker (mock A): a trigger button that opens a bottom sheet on phones and an anchored
 * popover on desktop (≥768px). Listbox ARIA, ↑↓/Home/End/Enter, type-ahead, Esc, focus returns to the trigger.
 */
export function Picker<V extends string | number>({
  id, label, value, options, onChange, search, testId, compact = false, className = "", disabled = false, placeholder = "Choose…", title, name, required = false,
}: {
  name?: string; required?: boolean;
  id?: string; label: string; value: V; options: PickerOption<V>[]; onChange: (v: V) => void;
  search?: boolean; testId?: string; compact?: boolean; className?: string; disabled?: boolean; placeholder?: string; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useDesktop();
  const trigger = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const tid = id ?? `pk${autoId}`;
  const sel = options.find((o) => o.value === value);
  const close = (focus = true) => { setOpen(false); if (focus) setTimeout(() => trigger.current?.focus(), 0); };

  return (
    <span className="relative block w-full">
      {(name || required) && (
        // Keeps native form submission / FormData / required validation working.
        <input aria-hidden tabIndex={-1} name={name} required={required} disabled={disabled} value={sel ? String(value) : ""} onChange={() => {}}
          onFocus={() => trigger.current?.focus()} className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0" />
      )}
      <button ref={trigger} id={tid} type="button" disabled={disabled} data-testid={testId} data-value={String(value)}
        aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${sel?.label ?? placeholder}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); } }}
        className={`flex w-full items-center gap-2.5 border border-[var(--line)] bg-[#fffefa] text-left text-[var(--forest)] transition-colors hover:border-slate-300 focus-visible:border-[#6b8061] focus-visible:shadow-[0_0_0_3px_#607d4c18] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-[#eeeee6] disabled:opacity-70 ${compact ? "h-10 rounded-md px-2" : "min-h-[2.75rem] rounded-md px-3 py-1"} ${className}`}>
        {sel && <Badge o={sel} />}
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-medium text-sm`}>{sel?.label ?? <span className="font-normal text-slate-500">{placeholder}</span>}</span>
          {!compact && sel?.sub && <span className="block truncate text-xs text-slate-500">{sel.sub}</span>}
        </span>
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 text-[#a3563a]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (desktop
        ? <Popover anchor={trigger} minW={options.some((o) => o.tag) ? 340 : 280}><PickerList label={label} value={value} options={options} search={search} onPick={(v) => { onChange(v); close(); }} onEsc={() => close()} testId={testId} desktop onOutside={() => close(false)} anchor={trigger} /></Popover>
        : <BottomSheet open onClose={() => close()} title={title ?? label} testId={testId ? `${testId}-sheet` : undefined}>
            <PickerList label={label} value={value} options={options} search={search} onPick={(v) => { onChange(v); close(); }} onEsc={() => close()} testId={testId} />
          </BottomSheet>)}
    </span>
  );
}

function Popover({ anchor, children, minW = 280 }: { anchor: React.RefObject<HTMLButtonElement | null>; children: ReactNode; minW?: number }) {
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect(); if (!r) return;
      const width = Math.max(r.width, minW), left = Math.min(r.left, innerWidth - width - 8);
      const below = innerHeight - r.bottom - 12, above = r.top - 12;
      if (below >= 260 || below >= above) setPos({ left, width, top: r.bottom + 6, maxH: Math.min(420, below) });
      else setPos({ left, width, bottom: innerHeight - r.top + 6, maxH: Math.min(420, above) });
    };
    place();
    addEventListener("resize", place); addEventListener("scroll", place, true);
    return () => { removeEventListener("resize", place); removeEventListener("scroll", place, true); };
  }, [anchor, minW]);
  if (!pos) return null;
  return createPortal(
    <div data-picker-popover className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]"
      style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}>{children}</div>,
    document.body,
  );
}

function PickerList<V extends string | number>({ label, value, options, search, onPick, onEsc, testId, desktop = false, onOutside, anchor }: {
  label: string; value: V; options: PickerOption<V>[]; search?: boolean; onPick: (v: V) => void; onEsc: () => void; testId?: string;
  desktop?: boolean; onOutside?: () => void; anchor?: React.RefObject<HTMLButtonElement | null>;
}) {
  const showSearch = search ?? options.length >= SEARCH_MIN;
  const [q, setQ] = useState("");
  const list = useMemo(() => { const s = q.trim().toLowerCase(); return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.sub?.toLowerCase().includes(s)) : options; }, [q, options]);
  const [activeRaw, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const active = Math.min(activeRaw, Math.max(0, list.length - 1));
  const root = useRef<HTMLDivElement>(null);
  const lb = useId();
  const typed = useRef({ s: "", t: 0 });
  const optId = (i: number) => `${lb}-o${i}`;

  useEffect(() => { document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" }); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Focus search (or the list) on open — the sheet also honours data-autofocus.
    const f = setTimeout(() => root.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), desktop ? 0 : 60);
    if (!desktop) return () => clearTimeout(f);
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!root.current?.contains(t) && !anchor?.current?.contains(t)) onOutside?.(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onEsc(); } if (e.key === "Tab") onOutside?.(); };
    document.addEventListener("pointerdown", down); document.addEventListener("keydown", key, true);
    return () => { clearTimeout(f); document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key, true); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e: React.KeyboardEvent) => {
    const n = list.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % Math.max(n, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + n) % Math.max(n, 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Enter" || (!showSearch && e.key === " ")) { e.preventDefault(); if (list[active]) onPick(list[active].value); }
    else if (!showSearch && e.key.length === 1) {
      const now = Date.now(); typed.current = { s: (now - typed.current.t < 700 ? typed.current.s : "") + e.key.toLowerCase(), t: now };
      const i = list.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.s)); if (i >= 0) setActive(i);
    }
  };

  const listbox = (
    <ul id={lb} role="listbox" aria-label={label} tabIndex={showSearch ? -1 : 0} data-autofocus={showSearch ? undefined : true}
      aria-activedescendant={!showSearch && list[active] ? optId(active) : undefined} onKeyDown={showSearch ? undefined : onKey}
      data-testid={testId ? `${testId}-list` : undefined}
      className={`outline-none ${desktop ? "min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5" : "-mx-3"}`}>
      {list.map((o, i) => {
        const selected = o.value === value;
        return (
          <li key={String(o.value)} id={optId(i)} role="option" aria-selected={selected} data-value={String(o.value)} data-active={i === active || undefined}
            onClick={() => onPick(o.value)} onPointerMove={() => setActive(i)}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 text-[15px] text-slate-950 ${selected ? "bg-teal-50" : ""} ${i === active ? "ring-2 ring-[#b66243]/70 ring-inset" : ""}`}>
            <Badge o={o} />
            <span className="min-w-0 flex-1">
              <span className="block truncate"><Highlight text={o.label} q={q} /></span>
              {o.sub && <span className="block truncate text-xs text-slate-500"><Highlight text={o.sub} q={q} /></span>}
            </span>
            {o.tag && <span className="shrink-0 rounded-full bg-[#b66243]/12 px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap text-[#8f4a31]">{o.tag}</span>}
            <span aria-hidden className={`w-4 shrink-0 text-base font-bold text-teal-700 ${selected ? "" : "invisible"}`}>✓</span>
          </li>
        );
      })}
      {!list.length && <li role="presentation" className="px-3 py-3 text-sm text-slate-500">No matches for “{q}”</li>}
    </ul>
  );

  return (
    <div ref={root} className={desktop ? "flex min-h-0 flex-col" : ""} data-testid={testId ? `${testId}-panel` : undefined}>
      {showSearch && (
        <div className={`sticky top-0 z-10 bg-white ${desktop ? "border-b border-slate-100 p-2" : "-mx-1 pb-2"}`}>
          <div className="flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-3 focus-within:border-[#b66243]">
            <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input data-autofocus role="combobox" aria-expanded aria-controls={lb} aria-autocomplete="list" aria-label={`Search ${label.toLowerCase()}`}
              aria-activedescendant={list[active] ? optId(active) : undefined} data-testid={testId ? `${testId}-search` : undefined}
              value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} placeholder="Search" style={{ outline: "none" }} autoComplete="off" spellCheck={false}
              className="min-w-0 flex-1 border-0 bg-transparent text-base shadow-none outline-none focus:shadow-none focus:outline-none focus-visible:outline-none placeholder:text-slate-500" />
            {q && <button type="button" onClick={() => { setQ(""); setActive(0); }} className="-mr-2 min-h-11 px-2 text-sm font-semibold text-[#a3563a]">Clear</button>}
          </div>
          <p className="sr-only" aria-live="polite">{q ? `${list.length} result${list.length === 1 ? "" : "s"}` : ""}</p>
        </div>
      )}
      {listbox}
    </div>
  );
}
