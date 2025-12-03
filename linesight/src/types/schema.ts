export type CtqDef = {
  id: number;
  code: string;
  name: string;
  units: string;
  lsl: number | null;
  usl: number | null;
  target: number | null;
  isCritical: boolean;
  direction: string;
};

export type StepDef = {
  id: number;
  code: string;
  name: string;
  stepType: string;
  sequence: number;
  canScrap: boolean;
  reworkTargets?: Array<{
    id: number;
    code: string;
    name: string;
    sequence: number;
  }>;
  ctqs: CtqDef[];
};

export type SchemaResponse = {
  steps: StepDef[];
  generatedAt: string;
};
