"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentCard } from "@/components/content-card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

type EpisodeListItem = {
  id: number;
  title: string;
  summary: string;
  status: string;
  rootCauseCategory: string;
  effectivenessTag: string | null;
  startTime: string | null;
  endTime: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type EpisodesListResponse = {
  episodes: EpisodeListItem[];
};

const formatRange = (start: string | null, end: string | null, formatter: Intl.DateTimeFormat) => {
  if (!start && !end) return "—";
  if (start && end) {
    return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`;
  }
  if (start) return `${formatter.format(new Date(start))} → ongoing`;
  return `Started earlier → ${formatter.format(new Date(end!))}`;
};

const statusClasses: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  CLOSED: "bg-emerald-50 text-emerald-700",
  MONITORING: "bg-blue-50 text-blue-700",
};

export default function EpisodesPage() {
  const router = useRouter();
  const [data, setData] = useState<EpisodesListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const fetchEpisodes = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (categoryFilter !== "ALL") params.set("category", categoryFilter);
        if (search.trim()) params.set("search", search.trim());

        const query = params.toString();
        const response = await fetch(query ? `/api/episodes?${query}` : "/api/episodes");
        if (!response.ok) throw new Error("Failed to fetch episodes");
        const json: EpisodesListResponse = await response.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled)
          setError("Unable to load episodes right now. Please retry shortly.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEpisodes();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, categoryFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Episodes / RCA"
        subtitle="Historical corrective actions and investigations on this line."
        breadcrumbs={[
          { label: "RCA & Knowledge" },
          { label: "Episodes" },
        ]}
      />

      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="text"
            placeholder="Search title or summary…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white/90 px-3 py-2 text-sm text-neutral-900 shadow-inner outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 md:max-w-sm"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white/90 px-3 py-2 text-sm text-neutral-900 shadow-inner outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="MONITORING">Monitoring</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white/90 px-3 py-2 text-sm text-neutral-900 shadow-inner outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            >
              <option value="ALL">All categories</option>
              <option value="COMPONENT">Component</option>
              <option value="FIXTURE">Fixture</option>
              <option value="PROCESS">Process</option>
              <option value="DESIGN">Design</option>
              <option value="OPERATOR">Operator</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-16 rounded-xl border border-neutral-200 bg-gradient-to-r from-neutral-50 via-white to-neutral-50"
              >
                <div className="h-full animate-pulse bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : !data || data.episodes.length === 0 ? (
          <p className="text-sm text-neutral-600">No episodes yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/70 shadow-inner shadow-slate-950/30">
            <table className="w-full border-collapse text-sm text-slate-200">
              <thead className="bg-slate-900/80 text-left text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Effectiveness</th>
                  <th className="px-4 py-3 font-semibold">Window</th>
                  <th className="px-4 py-3 font-semibold">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data.episodes.map((episode, idx) => {
                  const rowBg = idx % 2 === 0 ? "bg-slate-900/70" : "bg-slate-900/50";
                  return (
                    <tr
                      key={episode.id}
                      className={`${rowBg} cursor-pointer transition hover:bg-slate-800/60`}
                      onClick={() => router.push(`/episodes/${episode.id}`)}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-50">
                        {episode.title}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {episode.rootCauseCategory}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            statusClasses[episode.status] ??
                            "bg-slate-800 text-slate-100"
                          }`}
                        >
                          {episode.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {episode.effectivenessTag ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatRange(episode.startTime, episode.endTime, dateFormatter)}
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {episode.summary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
