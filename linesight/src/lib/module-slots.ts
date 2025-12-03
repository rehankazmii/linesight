export type ModuleSlot = {
  key: string;
  name: string;
  componentTypes: string[];
  x?: number; // percent from left
  y?: number; // percent from top
  anchor?: "left" | "right";
};

export const MODULE_SLOTS: ModuleSlot[] = [
  { key: "SAPPHIRE_FRONT", name: "Sapphire Crystal Front", componentTypes: ["Gasket"], x: 48, y: 10, anchor: "right" },
  { key: "DISPLAY_MODULE", name: "Display Module", componentTypes: ["Display"], x: 55, y: 22, anchor: "left" },
  { key: "GPS_MODULE", name: "GPS / GNSS", componentTypes: ["Antenna Flex"], x: 28, y: 24, anchor: "right" },
  { key: "ANTENNA_MODULES", name: "Antenna Modules", componentTypes: ["Antenna Flex"], x: 18, y: 32, anchor: "right" },
  { key: "S9_SIP", name: "S9 SiP", componentTypes: ["SiP", "SiP Module"], x: 38, y: 46, anchor: "right" },
  { key: "U2_ULTRAWIDEBAND", name: "U2 Ultrawideband", componentTypes: ["U2", "RF"], x: 58, y: 46, anchor: "left" },
  { key: "BATTERY", name: "Battery", componentTypes: ["Battery"], x: 44, y: 64, anchor: "right" },
  { key: "SPEAKERS", name: "Dual Speakers", componentTypes: ["Speaker Module"], x: 62, y: 58, anchor: "left" },
  { key: "MIC_ARRAY", name: "Microphone Array", componentTypes: ["Microphone"], x: 66, y: 30, anchor: "left" },
  { key: "ACTION_BUTTON", name: "Action Button", componentTypes: ["Action Button"], x: 74, y: 34, anchor: "left" },
  { key: "DIGITAL_CROWN", name: "Digital Crown", componentTypes: ["Crown Assembly"], x: 80, y: 40, anchor: "left" },
  { key: "SIDE_BUTTON", name: "Side Button", componentTypes: ["Side Button"], x: 74, y: 44, anchor: "left" },
  { key: "HEALTH_SENSOR_ARRAY", name: "Health Sensor Array", componentTypes: ["Rear Sensor", "Sensor"], x: 52, y: 74, anchor: "left" },
  { key: "DEPTH_TEMP_SENSOR", name: "Depth + Temp Sensor", componentTypes: ["Depth Sensor"], x: 64, y: 70, anchor: "left" },
  { key: "TEMP_SENSING", name: "Temperature Sensing", componentTypes: ["Temperature Sensor"], x: 66, y: 60, anchor: "left" },
  { key: "REAR_CRYSTAL_BACK", name: "Rear Crystal Back", componentTypes: ["Back Glass"], x: 48, y: 82, anchor: "right" },
  { key: "CHARGING_COIL", name: "Charging Coil", componentTypes: ["Charging Coil"], x: 40, y: 72, anchor: "right" },
];
