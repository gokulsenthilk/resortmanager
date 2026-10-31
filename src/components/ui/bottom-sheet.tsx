"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const DURATION = 280;
/** Open sheets, innermost last: only the top one reacts to Esc / back (nested pickers). */
const stack: object[] = [];
/** Programmatic history.back() calls whose popstate must not close the (new) top sheet. */
let selfPops = 0;
const back = () => { selfPops++; history.back(); };
let popWatch = false;
/** One permanent listener (registered before any sheet's) decides per event whether it was ours. */
function watchPops() {
  if (popWatch || typeof window === "undefined") return; popWatch = true;
  window.addEventListener("popstate", (e) => { const ev = e as PopStateEvent & { __self?: boolean }; ev.__self = selfPops > 0; if (ev.__self) selfPops--; });
}
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Airbnb-style bottom sheet: slides up from the bottom, dims the page, closes on ✕ / backdrop /
 * Esc / back button / swipe-down. Portaled to <body> so headers with backdrop-filter can't clip it.
 * On wide screens it becomes a centred dialog.
 */
export function BottomSheet({ open, onClose, title, children, footer, testId, role = "dialog" }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  testId?: string;
  role?: "dialog" | "alertdialog";
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  const restore = useRef<HTMLElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();

  // Mount → next frame slide in; close → slide out then unmount (state adjusted during render).
  if (open && !mounted) setMounted(true);
  if (!open && shown) { setShown(false); setDrag(0); }
  useEffect(() => {
    if (open) {
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    const t = setTimeout(() => setMounted(false), DURATION);
    return () => clearTimeout(t);
  }, [open]);

  const requestClose = useCallback(() => {
    if (pushed.current) { pushed.current = false; back(); }
    onCloseRef.current();
  }, []);

  // History entry so the phone/browser back button closes the sheet; Esc; scroll lock; focus.
  useEffect(() => {
    if (!open) return;
    watchPops(); const me = {}; stack.push(me);
    const top = () => stack[stack.length - 1] === me;
    restore.current = document.activeElement as HTMLElement | null;
    // Deferred so React StrictMode's mount → unmount → mount (dev) doesn't push/pop twice and race history.back().
    const push = setTimeout(() => { history.pushState({ ...(history.state ?? {}), __sheet: true }, ""); pushed.current = true; }, 0);
    const onPop = (e: PopStateEvent) => {
      if ((e as PopStateEvent & { __self?: boolean }).__self) return;
      if (top() && pushed.current) { pushed.current = false; onCloseRef.current(); } };
    const onKey = (e: KeyboardEvent) => {
      if (!top()) return;
      if (e.key === "Escape") { e.preventDefault(); requestClose(); }
      if (e.key === "Tab" && panel.current) {
        const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const f = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus() ?? panel.current?.focus(), 30);
    return () => {
      clearTimeout(f); clearTimeout(push);
      stack.splice(stack.indexOf(me), 1);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Closed by the parent (not ✕/back): drop our history entry too.
      if (pushed.current) { pushed.current = false; back(); }
      restore.current?.focus?.();
    };
  }, [open, requestClose]);

  if (!mounted || typeof document === "undefined") return null;

  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => { dragStart.current = e.clientY; setDragging(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); },
    onPointerMove: (e: React.PointerEvent) => { if (dragStart.current != null) setDrag(Math.max(0, e.clientY - dragStart.current)); },
    onPointerUp: () => { const d = drag; dragStart.current = null; setDragging(false); if (d > 90) requestClose(); else setDrag(0); },
    onPointerCancel: () => { dragStart.current = null; setDragging(false); setDrag(0); },
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" data-testid={testId ? `${testId}-root` : undefined}>
      <div
        aria-hidden
        data-testid="sheet-backdrop"
        onClick={requestClose}
        className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        data-state={shown ? "open" : "closed"}
        style={{ transform: shown ? `translateY(${drag}px)` : undefined, transitionDuration: dragging ? "0ms" : undefined }}
        className={`relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-[28px] bg-white text-slate-900 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)] outline-none transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:max-w-lg sm:rounded-[28px] ${shown ? "" : "translate-y-full opacity-0 sm:translate-y-6"}`}
      >
        <div className="shrink-0 touch-none select-none" {...dragHandlers}>
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-start justify-between gap-3 px-6 pt-3 sm:pt-5">
            <h2 id={titleId} className="pt-2 font-[family-name:var(--font-editorial)] text-[22px] leading-tight font-semibold text-slate-950">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              data-testid="sheet-close"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={requestClose}
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-slate-900 hover:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-3 pb-6 text-[15px] leading-relaxed text-slate-800">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-6 pt-3 pb-4">{footer}</div>}
        <div aria-hidden className="h-[env(safe-area-inset-bottom)] shrink-0 sm:hidden" />
      </div>
    </div>,
    document.body,
  );
}
