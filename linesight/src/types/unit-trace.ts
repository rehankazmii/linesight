export type UnitTraceResponse = {
  unit: {
    id: number;
    serial: string;
    createdAt: string;
    finalResult: string | null;
    reworkLoopCount: number;
  };
  kit: {
    id: number;
    lots: {
      id: number;
      code: string;
      type: string;
    }[];
  } | null;
  episodes: {
    id: number;
    title: string;
    status: string;
    rootCauseCategory: string;
    effectivenessTag: string;
    score?: number;
    matchReasons: string[];
    why?: string;
  }[];
  executions: {
    id: number;
    stepId: number;
    stepCode: string;
    stepName: string;
    stepType: string;
    startedAt: string;
    finishedAt: string;
    result: string;
    failureCode: string | null;
    reworkLoopId: string | null;
    stationId: string | null;
    fixtureCode: string | null;
    loopIndex?: number | null;
    loopPosition?: "start" | "middle" | "end" | "single";
    ctqs: {
      ctqId: number;
      code: string;
      name: string;
      units: string;
      value: number;
      inSpec: boolean;
      lowerSpecLimit?: number | null;
      upperSpecLimit?: number | null;
      target?: number | null;
    }[];
  }[];
};
