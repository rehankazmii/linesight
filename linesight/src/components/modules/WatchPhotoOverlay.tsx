"use client";

import Image from "next/image";
import { useMemo } from "react";

type OverlayModule = {
  moduleKey: string;
  moduleName: string;
  lotCode: string | null;
};

type WatchPhotoOverlayProps = {
  modules: OverlayModule[];
  selectedModuleKey: string | null;
  onSelectModule: (moduleKey: string) => void;
  loading?: boolean;
};

type ModuleSlot = {
  key: string;
  label: string;
  targetX: number;
  targetY: number;
  column: "left" | "center" | "right";
  order: number;
};

const COLUMN_X: Record<ModuleSlot["column"], number> = {
  left: 10,
  center: 50,
  right: 90,
};

const LABEL_TOP = 12;
const LABEL_STEP = 9.5;

// Coordinates tuned for /images/ultra2-components-grid.jpg (16:9)
const MODULE_SLOTS: ModuleSlot[] = [
  // LEFT column (top -> bottom)
  { key: "GPS_MODULE", label: "GPS / GNSS", targetX: 10, targetY: 17, column: "left", order: 0 },
  { key: "ANTENNA_MODULES", label: "Antenna Modules", targetX: 24, targetY: 22, column: "left", order: 1 },
  { key: "SAPPHIRE_FRONT", label: "Sapphire Crystal Front", targetX: 16, targetY: 46, column: "left", order: 2 },
  { key: "CHARGING_COIL", label: "Charging Coil", targetX: 16, targetY: 78, column: "left", order: 3 },

  // CENTER column
  { key: "U2_ULTRAWIDEBAND", label: "U2 Ultrawideband", targetX: 39, targetY: 18, column: "center", order: 0 },
  { key: "SPEAKERS", label: "Dual Speakers", targetX: 55, targetY: 20, column: "center", order: 1 },
  { key: "DISPLAY_MODULE", label: "Display Module", targetX: 35, targetY: 46, column: "center", order: 2 },
  { key: "S9_SIP", label: "S9 SiP / Logic Board", targetX: 52, targetY: 46, column: "center", order: 3 },
  { key: "REAR_CRYSTAL_BACK", label: "Rear Crystal Back", targetX: 35, targetY: 78, column: "center", order: 4 },
  { key: "DIGITAL_CROWN", label: "Digital Crown Module", targetX: 54, targetY: 78, column: "center", order: 5 },

  // RIGHT column
  { key: "MIC_ARRAY", label: "Microphone Array", targetX: 69, targetY: 19, column: "right", order: 0 },
  { key: "DEPTH_TEMP_SENSOR", label: "Depth / Temp Sensor", targetX: 84, targetY: 20, column: "right", order: 1 },
  { key: "BATTERY", label: "Battery", targetX: 73, targetY: 50, column: "right", order: 2 },
  { key: "HEALTH_SENSOR_ARRAY", label: "Health Sensor Array", targetX: 88, targetY: 55, column: "right", order: 3 },
  { key: "SIDE_BUTTON", label: "Side Button Module", targetX: 73, targetY: 78, column: "right", order: 4 },
  { key: "ACTION_BUTTON", label: "Action Button Module", targetX: 88, targetY: 78, column: "right", order: 5 },
];

export function WatchPhotoOverlay({
  modules,
  selectedModuleKey,
  onSelectModule,
  loading = false,
}: WatchPhotoOverlayProps) {
  const moduleMap = useMemo(() => {
    const map: Record<string, OverlayModule> = {};
    modules.forEach((m) => {
      map[m.moduleKey] = m;
    });
    return map;
  }, [modules]);

  const cx = (...classes: Array<string | null | false | undefined>) =>
    classes.filter(Boolean).join(" ");

  const slotsWithLots = MODULE_SLOTS.filter((slot) => {
    const data = moduleMap[slot.key];
    return data && data.lotCode;
  });

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-950 aspect-[16/9]">
      <Image
        src="/images/ultra2-components-grid.jpg"
        alt="Watch components grid"
        fill
        priority
        className="object-contain pointer-events-none select-none"
      />

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm text-slate-200">
          Loading modules…
        </div>
      ) : modules.length === 0 || slotsWithLots.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm text-slate-200">
          No module / lot data for this unit yet.
        </div>
      ) : (
        slotsWithLots.map((slot) => {
          const data = moduleMap[slot.key]!;
          const lot = data.lotCode!;
          const isSelected = selectedModuleKey === slot.key;
          const anchorX = COLUMN_X[slot.column];
          const anchorY = LABEL_TOP + slot.order * LABEL_STEP;

          return (
            <div key={slot.key}>
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                <line
                  x1={`${anchorX}%`}
                  y1={`${anchorY}%`}
                  x2={`${slot.targetX}%`}
                  y2={`${slot.targetY}%`}
                  stroke={isSelected ? "#22c55e" : "rgba(56,189,248,0.7)"}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeLinecap="round"
                />
                <circle
                  cx={`${slot.targetX}%`}
                  cy={`${slot.targetY}%`}
                  r={1.2}
                  className="fill-cyan-400"
                />
              </svg>

              <button
                type="button"
                onClick={() => onSelectModule(slot.key)}
                className={cx(
                  "absolute max-w-[9rem] truncate rounded-full border px-2 py-0.5 text-left text-[9px] leading-tight backdrop-blur-sm transition",
                  "bg-slate-950/75 border-cyan-500/70 text-sky-50 shadow-sm",
                  "hover:bg-cyan-500/15 hover:border-cyan-300",
                  isSelected && "border-emerald-400 bg-emerald-500/20 text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]",
                )}
                style={{
                  left: `${anchorX}%`,
                  top: `${anchorY}%`,
                  transform:
                    slot.column === "right"
                      ? "translateX(-100%)"
                      : slot.column === "center"
                        ? "translateX(-50%)"
                        : "translateX(0)",
                }}
              >
                <div className="font-semibold truncate">{slot.label}</div>
                <div className="text-[9px] text-sky-300/85 truncate">
                  {lot}
                </div>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
