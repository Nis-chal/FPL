"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/clubs", label: "Clubs" },
  { href: "/players", label: "Players" },
  { href: "/points", label: "Points" },
  { href: "/ai", label: "AI" },
  { href: "/squad", label: "Squad" },
  { href: "/recommend", label: "Recommend" },
  { href: "/transfers", label: "Transfers" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-bold text-zinc-950">
            FPL
          </span>
          <div>
            <div className="text-sm font-bold text-zinc-100">FPL Assistant</div>
            <div className="text-[11px] text-zinc-500">Form + fixtures analysis</div>
          </div>
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-zinc-800 text-emerald-400"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
