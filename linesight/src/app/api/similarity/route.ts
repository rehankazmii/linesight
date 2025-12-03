import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type SimilarityRequest = {
  affectedSteps?: { stepId: number; deltaFpy?: number }[];
  affectedCtqs?: { ctqId: number; direction?: "up" | "down" }[];
  lots?: number[];
  fixtures?: number[];
  failureCodes?: string[];
};

type SimilarEpisode = {
  id: number;
  title: string;
  status: string;
  rootCauseCategory: string;
  effectivenessTag: string | null;
  score: number;
  startTime: string | null;
  endTime: string | null;
  why: string;
};

type SimilarityResponse = {
  results: SimilarEpisode[];
};

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "number") return item;
      if (item && typeof item === "object") {
        const maybeId =
          (item as Record<string, unknown>).id ??
          (item as Record<string, unknown>).stepId ??
          (item as Record<string, unknown>).ctqId ??
          (item as Record<string, unknown>).lotId ??
          (item as Record<string, unknown>).fixtureId;
        return typeof maybeId === "number" ? maybeId : null;
      }
      return null;
    })
    .filter((num): num is number => typeof num === "number");
};

const overlapCount = (source: number[], candidate: number[]) => {
  const sourceSet = new Set(source);
  return candidate.filter((value) => sourceSet.has(value)).length;
};

const overlapStrings = (source: string[], candidate: string[]) => {
  const sourceSet = new Set(source.map((s) => s.toLowerCase()));
  return candidate.filter((value) => sourceSet.has(value.toLowerCase())).length;
};

const normalizeFailCode = (code: string) => code.trim().toLowerCase();

const collectFailureCodes = (payload: unknown): string[] => {
  if (!payload) return [];
  if (typeof payload === "string") return [normalizeFailCode(payload)];
  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => collectFailureCodes(entry));
  }
  if (typeof payload === "object") {
    return Object.values(payload as Record<string, unknown>).flatMap((v) =>
      collectFailureCodes(v),
    );
  }
  return [];
};

const collectCtqIds = (payload: unknown): number[] => toNumberArray(payload);

export async function POST(request: NextRequest) {
  let body: SimilarityRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const hasContext =
    (body.affectedSteps && body.affectedSteps.length > 0) ||
    (body.affectedCtqs && body.affectedCtqs.length > 0) ||
    (body.lots && body.lots.length > 0) ||
    (body.fixtures && body.fixtures.length > 0) ||
    (body.failureCodes && body.failureCodes.length > 0);

  if (!hasContext) {
    return NextResponse.json({ results: [] } satisfies SimilarityResponse);
  }

  const episodes = await prisma.episode.findMany();
  if (episodes.length === 0) {
    return NextResponse.json({ results: [] } satisfies SimilarityResponse);
  }

  const requestedCtqs = body.affectedCtqs?.map((ctq) => ctq.ctqId) ?? [];
  const requestedSteps = body.affectedSteps?.map((step) => step.stepId) ?? [];
  const requestedLots = body.lots ?? [];
  const requestedFixtures = body.fixtures ?? [];
  const requestedFailureCodes = (body.failureCodes ?? []).map(normalizeFailCode);

  const scored = episodes
    .map((episode) => {
      const episodeCtqs = collectCtqIds(episode.affectedCtqs);
      const episodeSteps = toNumberArray(episode.affectedSteps);
      const episodeLots = toNumberArray(episode.affectedLots);
      const episodeFixtures = toNumberArray(episode.affectedFixtures);
      const episodeFailures = collectFailureCodes(episode.beforeMetrics);

      const ctqOverlap = overlapCount(requestedCtqs, episodeCtqs);
      const stepOverlap = overlapCount(requestedSteps, episodeSteps);
      const lotOverlap = overlapCount(requestedLots, episodeLots);
      const fixtureOverlap = overlapCount(requestedFixtures, episodeFixtures);
      const failureOverlap = overlapStrings(requestedFailureCodes, episodeFailures);

      const score =
        ctqOverlap * 5 +
        stepOverlap * 3 +
        lotOverlap * 2 +
        fixtureOverlap * 1.5 +
        failureOverlap * 1;

      const whyParts: string[] = [];
      if (ctqOverlap > 0) whyParts.push("CTQ drift overlap");
      if (stepOverlap > 0) whyParts.push("Station/step overlap");
      if (lotOverlap > 0) whyParts.push("Lot overlap");
      if (fixtureOverlap > 0) whyParts.push("Fixture overlap");
      if (failureOverlap > 0) whyParts.push("Failure code overlap");

      return {
        episode,
        score,
        why: whyParts.join(" · "),
      };
    })
    .filter((entry) => entry.score > 0);

  if (scored.length === 0) {
    return NextResponse.json({ results: [] } satisfies SimilarityResponse);
  }

  const results = scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.episode.startedAt ?? a.episode.createdAt ?? null;
      const bTime = b.episode.startedAt ?? b.episode.createdAt ?? null;
      return (bTime?.getTime() ?? 0) - (aTime?.getTime() ?? 0);
    })
    .slice(0, 5)
    .map(
      (entry): SimilarEpisode => ({
        id: entry.episode.id,
        title: entry.episode.title,
        status: entry.episode.status,
        rootCauseCategory: entry.episode.rootCauseCategory,
        effectivenessTag: entry.episode.effectivenessTag ?? null,
        score: Number(entry.score.toFixed(2)),
        startTime: entry.episode.startedAt?.toISOString() ?? null,
        endTime: entry.episode.endedAt?.toISOString() ?? null,
        why: entry.why || "Pattern overlap detected.",
      }),
    );

  return NextResponse.json({ results } satisfies SimilarityResponse);
}
