"use client";

import { Fragment, useEffect, useState } from "react";
import { ContentCard } from "@/components/content-card";
import type { CtqDef, SchemaResponse } from "@/types/schema";

export default function SettingsPage() {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSchema = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/schema");
        if (!res.ok) throw new Error("Failed to fetch schema");
        const data: SchemaResponse = await res.json();
        if (isMounted) setSchema(data);
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError("Unable to load the process schema right now. Please try again in a moment.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSchema();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleExport = () => {
    if (!schema) return;
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "schema.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatSpec = (ctq: CtqDef) => {
    const lsl = ctq.lsl ?? "—";
    const target = ctq.target ?? "—";
    const usl = ctq.usl ?? "—";
    return `${lsl} / ${target} / ${usl}`;
  };

  const steps = schema?.steps ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Settings / Schema</h1>
          <p className="text-sm text-neutral-600">
            Read-only process configuration, CTQs, and demo context.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full border border-neutral-200 bg-neutral-900 px-3 py-1 text-xs font-medium text-white shadow-sm">
            About
          </span>
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm">
            Process Schema
          </span>
        </div>
      </div>

      <ContentCard
        title="About LineSight"
        subtitle="Context for this synthetic-data demo and the stack behind it."
      >
        <div className="space-y-3 text-sm text-neutral-700">
          <p>
            LineSight is a personal demo inspired by Apple Watch Ultra 2 FATP TPM workflows. It
            models a generic factory line for portfolio and practice only.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>All data in this app is synthetic and randomly generated.</li>
            <li>No Apple internal systems, confidential code, or production data are used.</li>
            <li>Single-user experience without authentication; everything runs locally.</li>
            <li>
              Built with Next.js App Router, React, TypeScript (strict), Tailwind CSS, Prisma, and
              SQLite.
            </li>
          </ul>
        </div>
      </ContentCard>

      <ContentCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Process Schema</h2>
            <p className="text-sm text-neutral-600">
              Ordered FATP steps with CTQs, rework targets, and scrappability.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!schema || steps.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
          >
            Export JSON
          </button>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-20 rounded-xl border border-neutral-200 bg-gradient-to-r from-neutral-50 via-white to-neutral-50"
              >
                <div className="h-full animate-pulse bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : steps.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            No process steps defined yet. Once the schema is configured, it will appear here.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white/80 shadow-inner">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Seq
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Scrap?
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Rework Targets
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {steps.map((step) => (
                  <Fragment key={step.id}>
                    <tr className="hover:bg-neutral-50/80">
                      <td className="px-4 py-3 font-medium text-neutral-900">{step.sequence}</td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{step.code}</td>
                      <td className="px-4 py-3 text-neutral-800">{step.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-neutral-700">
                          {step.stepType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-800">
                        {step.canScrap ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-800">
                        {step.reworkTargets && step.reworkTargets.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {step.reworkTargets.map((target) => (
                              <span
                                key={target.id}
                                className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700"
                              >
                                {target.code} · {target.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
                      </td>
                    </tr>
                    <tr className="bg-neutral-50/80">
                      <td colSpan={6} className="px-4 py-3">
                        {step.ctqs.length === 0 ? (
                          <p className="text-xs text-neutral-600">
                            No CTQs defined for this step yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {step.ctqs.map((ctq) => (
                              <div
                                key={ctq.id}
                                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-neutral-900">
                                    {ctq.name}
                                  </p>
                                  <p className="text-xs text-neutral-600">
                                    Units: {ctq.units || "Unitless"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700">
                                  <span className="rounded-full bg-neutral-100 px-2 py-1 font-medium text-neutral-800">
                                    Spec: {formatSpec(ctq)}
                                  </span>
                                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 font-medium text-neutral-700">
                                    Direction: {ctq.direction}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-1 font-medium ${
                                      ctq.isCritical
                                        ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                    }`}
                                  >
                                    {ctq.isCritical ? "Critical" : "Standard"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {schema?.generatedAt ? (
          <p className="mt-3 text-right text-xs text-neutral-500">
            Generated at {new Date(schema.generatedAt).toLocaleString()}
          </p>
        ) : null}
      </ContentCard>
    </div>
  );
}
