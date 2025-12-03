"use client";

import { ReactNode } from "react";
import clsx from "clsx";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Card({ title, subtitle, children, footer, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-slate-800/70 bg-slate-900/70 shadow-lg shadow-slate-950/40 backdrop-blur-sm",
        className,
      )}
    >
      {(title || subtitle) && (
        <div className="border-b border-slate-800/60 px-5 py-4">
          {title ? <h3 className="text-base font-semibold text-slate-50">{title}</h3> : null}
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
      {footer ? <div className="border-t border-slate-800/60 px-5 py-3">{footer}</div> : null}
    </div>
  );
}
