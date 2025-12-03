"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type NavItem = {
  label: string;
  href: string;
  hint?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    title: "Run",
    items: [
      { label: "Line Dashboard", href: "/line", hint: "RTY / FPY / flow" },
      { label: "Stations", href: "/stations", hint: "Per-station yield" },
    ],
  },
  {
    title: "Analyze",
    items: [
      { label: "CTQs", href: "/ctqs", hint: "Specs + fallout" },
      { label: "Units / Serials", href: "/units", hint: "Traceability" },
      { label: "Lots & Suppliers", href: "/lots", hint: "Lots + heatmap" },
      { label: "Fixtures", href: "/fixtures", hint: "Health + calibration" },
    ],
  },
  {
    title: "RCA & Knowledge",
    items: [
      { label: "Episodes / RCA", href: "/episodes", hint: "Root causes" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Data Health", href: "/debug/data-quality", hint: "Logging quality" },
      { label: "Settings / Schema", href: "/settings", hint: "Process + CTQs" },
      { label: "Debug", href: "/debug", hint: "Raw counts" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-68 flex-col border-r border-slate-800/80 bg-slate-950/90 px-4 py-6">
      <div className="space-y-1 px-2 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          LineSight
        </p>
        <h1 className="text-lg font-semibold text-slate-50">Apple Watch Ultra 2</h1>
        <p className="text-xs text-slate-500">FATP quality cockpit</p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {NAV.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.href === "/line"
                    ? pathname === "/" || pathname === "/line"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "group flex flex-col rounded-xl border border-transparent px-3 py-2 transition",
                      active
                        ? "border-slate-700 bg-slate-800/80 text-slate-50 shadow-sm shadow-slate-950/30"
                        : "text-slate-300 hover:border-slate-800 hover:bg-slate-900/70",
                    )}
                  >
                    <span className="text-sm font-semibold">{item.label}</span>
                    {item.hint ? (
                      <span className="text-xs text-slate-500 group-hover:text-slate-400">
                        {item.hint}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 rounded-xl border border-slate-800/70 bg-slate-900/70 p-3 text-xs text-slate-400">
        <p className="font-semibold text-slate-200">Demo</p>
        <p>All data synthetic.</p>
      </div>
    </aside>
  );
}
