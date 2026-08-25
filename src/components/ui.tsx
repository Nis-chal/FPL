import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  accent,
  tip,
}: {
  label: string;
  value: string;
  accent?: boolean;
  /** Hover / focus tooltip (e.g. recommended captain why). */
  tip?: ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-xl border border-zinc-800 bg-zinc-950/60 p-3",
        tip ? "group relative cursor-help" : "",
      ].join(" ")}
      tabIndex={tip ? 0 : undefined}
    >
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
        {tip && (
          <span className="rounded-full border border-zinc-600 px-1 text-[9px] font-bold text-zinc-400">
            ?
          </span>
        )}
      </div>
      <div
        className={[
          "mt-1 text-2xl font-bold",
          accent ? "text-emerald-400" : "text-zinc-100",
        ].join(" ")}
      >
        {value}
      </div>
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-left shadow-xl group-hover:block group-focus-within:block"
        >
          {tip}
        </div>
      )}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
      {message}
    </div>
  );
}
