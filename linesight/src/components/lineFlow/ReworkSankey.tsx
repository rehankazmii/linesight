"use client";

import { useMemo, useState } from "react";
import type { SankeyLink, SankeyNode } from "@/server/lineFlow/getReworkFlowData";

type Props = {
  nodes: SankeyNode[];
  links: SankeyLink[];
  showOnlyRework?: boolean;
};

const MAX_STROKE = 18;
const MIN_STROKE = 2;

export default function ReworkSankey({ nodes, links, showOnlyRework = false }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const nodePositions = useMemo(() => {
    const spacingY = 18;
    return nodes.reduce<Record<string, { x: number; y: number }>>((acc, node, idx) => {
      acc[node.id] = { x: (idx / Math.max(1, nodes.length - 1)) * 90 + 5, y: 12 + idx * spacingY };
      return acc;
    }, {});
  }, [nodes]);

  const filteredLinks = showOnlyRework ? links.filter((l) => l.kind !== "forward") : links;

  const maxVal = Math.max(...filteredLinks.map((l) => l.value), 1);

  const colorForLink = (link: SankeyLink) => {
    if (link.kind === "scrap" || link.target === "SCRAP") return "#ef4444";
    if (link.kind === "rework") return "#f59e0b";
    return "#0ea5e9";
  };

  const strokeForVal = (v: number) => Math.max(MIN_STROKE, Math.min(MAX_STROKE, (v / maxVal) * MAX_STROKE));

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 shadow-sm">
      <svg viewBox="0 0 100 220" className="h-96 w-full">
        {filteredLinks.map((link, idx) => {
          const srcPos = nodePositions[link.source];
          const tgtPos = nodePositions[link.target];
          if (!srcPos || !tgtPos) return null;
          const midX = (srcPos.x + tgtPos.x) / 2;
          const d = `M ${srcPos.x},${srcPos.y} C ${midX},${srcPos.y} ${midX},${tgtPos.y} ${tgtPos.x},${tgtPos.y}`;
          const stroke = strokeForVal(link.value);
          return (
            <path
              key={idx}
              d={d}
              fill="none"
              stroke={colorForLink(link)}
              strokeWidth={stroke}
              opacity={hover === `${link.source}->${link.target}` ? 0.9 : 0.6}
              onMouseEnter={() => setHover(`${link.source}->${link.target}`)}
              onMouseLeave={() => setHover(null)}
            >
              <title>
                {link.source} → {link.target}: {link.value} units
              </title>
            </path>
          );
        })}

        {nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          return (
            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <circle r={4} className="fill-slate-200" />
              <text x={0} y={-8} textAnchor="middle" className="fill-slate-50 text-[9px] font-semibold">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded-full bg-sky-500" />
          Forward flow / normal transitions
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded-full bg-amber-500" />
          Rework/debug loops
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded-full bg-rose-500" />
          Scrap exits
        </span>
      </div>
    </div>
  );
}
