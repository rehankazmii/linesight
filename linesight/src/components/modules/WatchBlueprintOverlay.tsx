"use client";

import Image from "next/image";
import { useMemo } from "react";

type OverlayModule = {
  moduleKey: string;
  moduleName: string;
  lotCode: string | null;
};

type WatchBlueprintOverlayProps = {
  modules: OverlayModule[];
  selectedModuleKey: string | null;
  onSelectModule: (moduleKey: string) => void;
  loading?: boolean;
};

type ModuleSlot = {
  key: string;
  label: string;
  anchorX: number; // % from left for label pill
  anchorY: number; // % from top for label pill
  targetX: number; // % from left for leader line target
  targetY: number; // % from top for leader line target
  align?: "left" | "right";
};

const MODULE_SLOTS: ModuleSlot[] = [
  // Left side callouts (evenly spaced to avoid overlap)
  { key: "GPS_MODULE", label: "GPS / GNSS", anchorX: 12, anchorY: 16, targetX: 35, targetY: 18, align: "left" },
  { key: "ANTENNA_MODULES", label: "Antenna Modules", anchorX: 12, anchorY: 26, targetX: 33, targetY: 26, align: "left" },
  { key: "U2_ULTRAWIDEBAND", label: "U2 Ultrawideband", anchorX: 12, anchorY: 36, targetX: 35, targetY: 34, align: "left" },
  { key: "SPEAKERS", label: "Dual Speakers", anchorX: 12, anchorY: 46, targetX: 34, targetY: 44, align: "left" },
  { key: "MIC_ARRAY", label: "Microphone Array", anchorX: 12, anchorY: 56, targetX: 34, targetY: 54, align: "left" },
  { key: "DEPTH_TEMP_SENSOR", label: "Depth / Temp Sensor", anchorX: 12, anchorY: 66, targetX: 36, targetY: 64, align: "left" },
  { key: "TEMP_SENSING", label: "Temperature Sensing", anchorX: 12, anchorY: 76, targetX: 38, targetY: 74, align: "left" },

  // Central stack (aligned down the middle)
  { key: "SAPPHIRE_FRONT", label: "Sapphire Crystal Front", anchorX: 50, anchorY: 12, targetX: 50, targetY: 14, align: "right" },
  { key: "DISPLAY_MODULE", label: "Display Module", anchorX: 50, anchorY: 24, targetX: 50, targetY: 24, align: "right" },
  { key: "S9_SIP", label: "S9 SiP", anchorX: 50, anchorY: 36, targetX: 50, targetY: 36, align: "right" },
  { key: "BATTERY", label: "Battery", anchorX: 50, anchorY: 50, targetX: 50, targetY: 50, align: "right" },
  { key: "HEALTH_SENSOR_ARRAY", label: "Health Sensor Array", anchorX: 50, anchorY: 64, targetX: 50, targetY: 64, align: "right" },
  { key: "CHARGING_COIL", label: "Charging Coil", anchorX: 50, anchorY: 78, targetX: 50, targetY: 78, align: "right" },
  { key: "REAR_CRYSTAL_BACK", label: "Rear Crystal Back", anchorX: 50, anchorY: 90, targetX: 50, targetY: 90, align: "right" },

  // Right side controls
  { key: "DIGITAL_CROWN", label: "Digital Crown", anchorX: 88, anchorY: 30, targetX: 64, targetY: 30, align: "right" },
  { key: "SIDE_BUTTON", label: "Side Button", anchorX: 88, anchorY: 42, targetX: 64, targetY: 40, align: "right" },
  { key: "ACTION_BUTTON", label: "Action Button", anchorX: 88, anchorY: 54, targetX: 64, targetY: 50, align: "right" },
];

export function WatchBlueprintOverlay({
  modules,
  selectedModuleKey,
  onSelectModule,
  loading = false,
}: WatchBlueprintOverlayProps) {
  const cx = (...classes: Array<string | null | false | undefined>) =>
    classes.filter(Boolean).join(" ");

  const moduleMap = useMemo(() => {
    const map: Record<string, OverlayModule> = {};
    modules.forEach((m) => {
      map[m.moduleKey] = m;
    });
    return map;
  }, [modules]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-950 aspect-[16/9]">
      <Image
        src="/ultra2-exploded.png"
        alt="Watch module blueprint"
        fill
        priority
        className="object-contain pointer-events-none select-none"
      />

      {/* Leader lines and markers */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
      >
        {MODULE_SLOTS.map((slot) => {
          const isSelected = selectedModuleKey === slot.key;
          return (
            <g key={`line-${slot.key}`}>
              <line
                x1={slot.targetX}
                y1={slot.targetY}
                x2={slot.anchorX}
                y2={slot.anchorY}
                className={cx(
                  "stroke-cyan-400/70",
                  "transition",
                  isSelected ? "stroke-emerald-400 stroke-[0.8]" : "stroke-[0.6]",
                )}
              />
              <circle
                cx={slot.targetX}
                cy={slot.targetY}
                r={0.8}
                className={cx(isSelected ? "fill-emerald-400" : "fill-cyan-400")}
              />
            </g>
          );
        })}
      </svg>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-sm text-slate-200">
          Loading module diagram…
        </div>
      ) : modules.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-sm text-slate-200">
          No module / lot data for this unit yet.
        </div>
      ) : (
        MODULE_SLOTS.map((slot) => {
          const data = moduleMap[slot.key];
          const lot = data?.lotCode ?? "No lot";
          const isSelected = selectedModuleKey === slot.key;
          return (
            <button
              key={slot.key}
              type="button"
              onClick={() => onSelectModule(slot.key)}
              className={cx(
                "absolute max-w-[11rem] truncate rounded-full border px-3 py-1.5 text-left text-[11px] leading-tight backdrop-blur-sm transition",
                "bg-slate-950/70 border-cyan-500/60 text-sky-100 hover:bg-cyan-500/10",
                isSelected && "border-emerald-400 bg-emerald-500/15 text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]",
              )}
              style={{
                left: `${slot.anchorX}%`,
                top: `${slot.anchorY}%`,
                transform: slot.align === "right" ? "translateX(-100%)" : "translateX(0)",
              }}
            >
              <div className="font-semibold truncate">{slot.label}</div>
              <div className="text-[10px] text-sky-300/80 truncate">{lot}</div>
            </button>
          );
        })
      )}
    </div>
  );
}
