import { ReactNode } from "react";

type ContentCardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function ContentCard({
  title,
  subtitle,
  children,
  className = "",
}: ContentCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-800/70 bg-slate-900/80 p-5 text-slate-100 shadow-lg shadow-slate-950/40 backdrop-blur-sm ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-4 space-y-1">
          {title ? (
            <h2 className="text-lg font-semibold leading-tight text-slate-50">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="text-sm text-slate-300">{subtitle}</p>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
