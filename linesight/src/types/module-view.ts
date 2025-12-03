export type ModuleLotMetrics = {
  moduleKey: string;
  moduleName: string;
  lotId: number | null;
  lotCode: string | null;
  supplier?: string | null;
  unitsBuilt: number;
  passFirstTryUnits: number;
  reworkUnits: number;
  scrapUnits: number;
  fpy: number;
  reworkRate: number;
  scrapRate: number;
};

export type ModuleViewResponse = {
  unitSerial: string;
  unitId: number;
  modules: ModuleLotMetrics[];
};
