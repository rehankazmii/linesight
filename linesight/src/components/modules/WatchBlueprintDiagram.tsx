"use client";

import { useMemo, useState } from "react";

type WatchBlueprintDiagramProps = {
  modules: { moduleKey: string; moduleName: string; lotCode: string | null }[];
  selectedModuleKey: string | null;
  onSelectModule: (moduleKey: string) => void;
};

type Slot = {
  key: string;
  label: string;
  anchorX: number;
  anchorY: number;
  targetX: number;
  targetY: number;
};

const SLOTS: Slot[] = [
  { key: "SAPPHIRE_FRONT", label: "Sapphire Front", anchorX: 150, anchorY: 90, targetX: 520, targetY: 120 },
  { key: "DISPLAY_MODULE", label: "Display Module", anchorX: 200, anchorY: 150, targetX: 520, targetY: 190 },
  { key: "S9_SIP", label: "S9 SiP", anchorX: 180, anchorY: 240, targetX: 520, targetY: 270 },
  { key: "BATTERY", label: "Battery", anchorX: 200, anchorY: 320, targetX: 520, targetY: 330 },
  { key: "U2_ULTRAWIDEBAND", label: "U2 Chip", anchorX: 1000, anchorY: 140, targetX: 680, targetY: 220 },
  { key: "GPS_MODULE", label: "GPS/GNSS", anchorX: 1050, anchorY: 200, targetX: 700, targetY: 260 },
  { key: "ANTENNA_MODULES", label: "Antennas", anchorX: 1030, anchorY: 260, targetX: 700, targetY: 300 },
  { key: "SPEAKERS", label: "Speakers", anchorX: 1040, anchorY: 320, targetX: 700, targetY: 340 },
  { key: "MIC_ARRAY", label: "Mic Array", anchorX: 1020, anchorY: 380, targetX: 700, targetY: 380 },
  { key: "DIGITAL_CROWN", label: "Digital Crown", anchorX: 980, anchorY: 440, targetX: 680, targetY: 420 },
  { key: "SIDE_BUTTON", label: "Side Button", anchorX: 900, anchorY: 470, targetX: 640, targetY: 440 },
  { key: "ACTION_BUTTON", label: "Action Button", anchorX: 860, anchorY: 520, targetX: 620, targetY: 470 },
  { key: "HEALTH_SENSOR_ARRAY", label: "Health Sensor Array", anchorX: 150, anchorY: 500, targetX: 520, targetY: 420 },
  { key: "DEPTH_TEMP_SENSOR", label: "Depth/Temp Sensor", anchorX: 200, anchorY: 560, targetX: 520, targetY: 480 },
  { key: "TEMP_SENSING", label: "Temp Sensing", anchorX: 250, anchorY: 610, targetX: 520, targetY: 520 },
  { key: "CHARGING_COIL", label: "Charging Coil", anchorX: 600, anchorY: 620, targetX: 520, targetY: 560 },
  { key: "REAR_CRYSTAL_BACK", label: "Rear Crystal Back", anchorX: 680, anchorY: 620, targetX: 520, targetY: 600 },
];

export function WatchBlueprintDiagram({
  modules,
  selectedModuleKey,
  onSelectModule,
}: WatchBlueprintDiagramProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const moduleMap = useMemo(() => {
    const map: Record<string, { moduleName: string; lotCode: string | null }> = {};
    modules.forEach((m) => {
      map[m.moduleKey] = { moduleName: m.moduleName, lotCode: m.lotCode };
    });
    return map;
  }, [modules]);

  const isDisabled = (key: string) => !moduleMap[key]?.lotCode;

  const cx = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" ");

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-inner">
      <svg
        viewBox="0 0 1200 700"
        className="h-full w-full text-sky-300"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Apple Watch Ultra 2 blueprint"
      >
        <defs>
          <linearGradient id="bgGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="100%" stopColor="#02091b" />
          </linearGradient>
          <pattern id="smallGrid" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#0f172a" strokeWidth="0.6" />
          </pattern>
          <pattern id="gridPattern" width="140" height="140" patternUnits="userSpaceOnUse">
            <rect width="140" height="140" fill="url(#smallGrid)" />
            <path d="M 140 0 L 0 0 0 140" fill="none" stroke="#0b1221" strokeWidth="1.1" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="1200" height="700" fill="url(#bgGradient)" />
        <rect x="0" y="0" width="1200" height="700" fill="url(#gridPattern)" opacity="0.35" />

        <g id="watch-body">
          <rect
            x="450"
            y="120"
            width="250"
            height="420"
            rx="28"
            ry="28"
            className="fill-slate-900/30 stroke-sky-400 stroke-[1.5]"
          />
          <rect
            x="480"
            y="160"
            width="190"
            height="260"
            rx="22"
            ry="22"
            className={cx(
              "fill-slate-900/25 stroke-sky-400 stroke-[1.4]",
              selectedModuleKey === "DISPLAY_MODULE" && "stroke-emerald-400 stroke-[3]",
            )}
          />
          <rect
            x="500"
            y="190"
            width="120"
            height="70"
            rx="10"
            ry="10"
            className={cx(
              "fill-slate-900/35 stroke-sky-400 stroke-[1.4]",
              selectedModuleKey === "S9_SIP" && "stroke-emerald-400 stroke-[3]",
            )}
          />
          <rect
            x="490"
            y="280"
            width="140"
            height="90"
            rx="12"
            ry="12"
            className={cx(
              "fill-slate-900/35 stroke-sky-400 stroke-[1.4]",
              selectedModuleKey === "BATTERY" && "stroke-emerald-400 stroke-[3]",
            )}
          />
          <rect
            x="500"
            y="380"
            width="120"
            height="60"
            rx="10"
            ry="10"
            className="fill-slate-900/35 stroke-sky-400 stroke-[1.3]"
          />
          <g className={cx(selectedModuleKey === "REAR_CRYSTAL_BACK" && "stroke-emerald-400")}>
            <circle cx="575" cy="440" r="70" className="fill-slate-900/25 stroke-sky-400 stroke-[1.4]" />
            <circle
              cx="575"
              cy="440"
              r="40"
              className={cx(
                "fill-slate-900/30 stroke-sky-400 stroke-[1.2]",
                selectedModuleKey === "HEALTH_SENSOR_ARRAY" && "stroke-emerald-400 stroke-[3]",
              )}
            />
          </g>
          <rect
            x="675"
            y="240"
            width="40"
            height="90"
            rx="12"
            className={cx(
              "fill-slate-900/25 stroke-sky-400 stroke-[1.4]",
              selectedModuleKey === "DIGITAL_CROWN" && "stroke-emerald-400 stroke-[3]",
            )}
          />
        </g>

        {SLOTS.map((slot) => {
          const moduleData = moduleMap[slot.key];
          const disabled = isDisabled(slot.key);
          const selected = selectedModuleKey === slot.key;
          const hovered = hoveredKey === slot.key;
          const label = moduleData?.moduleName ?? slot.label;
          const lot = moduleData?.lotCode ?? "No lot";
          const lineClass = cx(
            "transition-all",
            selected
              ? "stroke-emerald-400 stroke-[3]"
              : hovered
                ? "stroke-sky-300 stroke-[2]"
                : "stroke-sky-500/70 stroke-[1.5]",
            disabled && "opacity-40",
          );
          const pillClass = cx(
            "transition",
            "fill-transparent stroke-sky-500/70 stroke-[1]",
            hovered && "fill-sky-500/10 stroke-sky-300",
            selected && "fill-emerald-500/15 stroke-emerald-400 stroke-[2.5]",
            disabled && "opacity-40",
          );
          const textClass = cx(
            "transition",
            selected ? "fill-emerald-100 font-semibold" : hovered ? "fill-sky-50" : "fill-sky-200",
          );
          return (
            <g key={slot.key}>
              <line x1={slot.targetX} y1={slot.targetY} x2={slot.anchorX} y2={slot.anchorY} className={lineClass} />
              <circle
                cx={slot.targetX}
                cy={slot.targetY}
                r={5}
                className={cx(
                  "transition",
                  selected ? "fill-emerald-400" : "fill-sky-400",
                  disabled && "opacity-40",
                )}
              />
              <g
                className={cx(disabled ? "cursor-not-allowed" : "cursor-pointer")}
                onMouseEnter={() => setHoveredKey(slot.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => !disabled && onSelectModule(slot.key)}
              >
                <rect
                  x={slot.anchorX - 90}
                  y={slot.anchorY - 20}
                  width={180}
                  height={48}
                  rx={10}
                  className={pillClass}
                />
                <text x={slot.anchorX} y={slot.anchorY} textAnchor="middle" className={textClass} fontSize={13}>
                  {label}
                </text>
                <text
                  x={slot.anchorX}
                  y={slot.anchorY + 16}
                  textAnchor="middle"
                  className={cx("fill-sky-300 text-[11px]", selected && "fill-emerald-100")}
                >
                  {lot}
                </text>
              </g>
            </g>
          );
        })}

        <g transform="translate(40,650)" className="text-[11px]">
          <rect x="0" y="0" width="18" height="12" className="fill-transparent stroke-sky-400 stroke-[1.5]" />
          <text x="24" y="10" className="fill-sky-200">
            Normal
          </text>
          <rect x="100" y="0" width="18" height="12" className="fill-emerald-500/15 stroke-emerald-400 stroke-[2.5]" />
          <text x="124" y="10" className="fill-sky-200">
            Selected
          </text>
        </g>
      </svg>
    </div>
  );
}
