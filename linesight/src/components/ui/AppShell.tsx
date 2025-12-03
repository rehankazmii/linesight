"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import LineAssistant from "../LineAssistant";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <main className="relative mx-auto flex max-w-7xl gap-6 px-6 py-6">
          <div className="w-full space-y-6 pb-12">{children}</div>
          <aside className="sticky top-20 hidden h-[calc(100vh-120px)] w-80 shrink-0 lg:block">
            <div className="h-full rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 shadow-inner shadow-slate-950/30">
              <LineAssistant />
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
