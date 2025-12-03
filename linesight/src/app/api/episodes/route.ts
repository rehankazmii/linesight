import { NextRequest, NextResponse } from "next/server";

import { EpisodeStatus, RootCauseCategory } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

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

const trimSummary = (text: string, maxLength = 200) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const categoryParam = url.searchParams.get("category");
    const searchParam = url.searchParams.get("search")?.trim() ?? "";

    const statusFilter = Object.values(EpisodeStatus).includes(statusParam as EpisodeStatus)
      ? (statusParam as EpisodeStatus)
      : undefined;
    const categoryFilter = Object.values(RootCauseCategory).includes(categoryParam as RootCauseCategory)
      ? (categoryParam as RootCauseCategory)
      : undefined;

    const episodes = await prisma.episode.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(categoryFilter ? { rootCauseCategory: categoryFilter } : {}),
        ...(searchParam
          ? {
              OR: [
                { title: { contains: searchParam } },
                { summary: { contains: searchParam } },
              ],
            }
          : {}),
      },
      orderBy: [
        { startedAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    const response: EpisodesListResponse = {
      episodes: episodes.map((episode) => ({
        id: episode.id,
        title: episode.title,
        summary: trimSummary(episode.summary),
        status: episode.status,
        rootCauseCategory: episode.rootCauseCategory,
        effectivenessTag: episode.effectivenessTag ?? null,
        startTime: episode.startedAt?.toISOString() ?? null,
        endTime: episode.endedAt?.toISOString() ?? null,
        createdAt: episode.createdAt?.toISOString() ?? null,
        updatedAt: episode.updatedAt?.toISOString() ?? null,
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Failed to load episodes", err);
    return NextResponse.json({ episodes: [] } satisfies EpisodesListResponse, { status: 200 });
  }
}
