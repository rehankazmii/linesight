import { ReactNode } from "react";
import clsx from "clsx";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, breadcrumbs = [], actions, className }: PageHeaderProps) {
  return (
    <div className={clsx("flex flex-col gap-3", className)}>
      {breadcrumbs.length > 0 ? (
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.label} className="flex items-center gap-2">
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="font-semibold text-slate-300 transition hover:text-slate-50"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="font-semibold text-slate-400">{crumb.label}</span>
              )}
              {idx < breadcrumbs.length - 1 ? <span className="text-slate-600">/</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
