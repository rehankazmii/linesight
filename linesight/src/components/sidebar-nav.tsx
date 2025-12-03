"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  hint?: string;
  subtle?: boolean;
};

const navItems: NavItem[] = [
  { label: "Line Overview", href: "/" },
  { label: "Stations", href: "/stations", hint: "FPY, yield, bottlenecks" },
  { label: "Trends", href: "/trends", hint: "TPM scenarios" },
  { label: "Units", href: "/units", hint: "Serial traceability" },
  { label: "Lots", href: "/lots", hint: "Component lots & health" },
  { label: "Fixtures", href: "/fixtures", hint: "Fixture health & usage" },
  { label: "Episodes / RCA", href: "/episodes", hint: "Corrective actions" },
  { label: "Settings / Schema", href: "/settings", hint: "Process + CTQs" },
  { label: "Debug", href: "/debug", hint: "DB counts", subtle: true },
];

const baseClasses =
  "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`${baseClasses} ${
              isActive
                ? "bg-slate-800 text-slate-50"
                : item.subtle
                  ? "text-slate-400 hover:bg-slate-800/60"
                  : "text-slate-200 hover:bg-slate-800/70"
            } ${item.subtle ? "px-3 py-1.5 text-xs" : ""}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">{item.label}</span>
              {item.hint ? (
                <span
                  className={`text-[11px] leading-tight ${
                    isActive
                      ? "text-slate-300"
                      : item.subtle
                        ? "text-slate-500"
                        : "text-slate-400"
                  }`}
                >
                  {item.hint}
                </span>
              ) : null}
            </div>
            <span
              className={`h-2 w-2 rounded-full ${
                isActive
                  ? "bg-emerald-400"
                  : item.subtle
                    ? "bg-slate-700"
                    : "bg-slate-600"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
