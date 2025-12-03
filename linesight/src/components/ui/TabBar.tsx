"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

type Tab = {
  label: string;
  href: string;
};

type TabBarProps = {
  tabs: Tab[];
  className?: string;
};

export function TabBar({ tabs, className }: TabBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-slate-800/70 bg-slate-900/70 p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const url = search ? `${tab.href}?${search}` : tab.href;
        return (
          <Link
            key={tab.href}
            href={url}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              isActive
                ? "bg-slate-800 text-slate-50 shadow-sm shadow-slate-950/40"
                : "text-slate-300 hover:bg-slate-800/70",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
