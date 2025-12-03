-- CreateTable
CREATE TABLE "Unit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serial" TEXT NOT NULL,
    "kitId" INTEGER,
    "finalResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Unit_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Kit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ComponentLot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lotNumber" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "supplier" TEXT,
    "receivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "KitComponentLot" (
    "kitId" INTEGER NOT NULL,
    "componentLotId" INTEGER NOT NULL,
    "quantityUsed" INTEGER,

    PRIMARY KEY ("kitId", "componentLotId"),
    CONSTRAINT "KitComponentLot_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KitComponentLot_componentLotId_fkey" FOREIGN KEY ("componentLotId") REFERENCES "ComponentLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessStepDefinition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stepType" TEXT NOT NULL,
    "canScrap" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProcessStepExecution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unitId" INTEGER NOT NULL,
    "stepDefinitionId" INTEGER NOT NULL,
    "stationCode" TEXT NOT NULL,
    "fixtureId" INTEGER,
    "operatorId" TEXT,
    "result" TEXT NOT NULL,
    "failureCode" TEXT,
    "reworkLoopId" TEXT,
    "originalFailureStepId" INTEGER,
    "originalFailureCode" TEXT,
    "loopStartTime" DATETIME,
    "loopEndTime" DATETIME,
    "loopFinalOutcome" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ProcessStepExecution_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessStepExecution_stepDefinitionId_fkey" FOREIGN KEY ("stepDefinitionId") REFERENCES "ProcessStepDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessStepExecution_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProcessStepExecution_originalFailureStepId_fkey" FOREIGN KEY ("originalFailureStepId") REFERENCES "ProcessStepDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CTQDefinition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "processStepDefinitionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "units" TEXT,
    "lowerSpecLimit" REAL,
    "upperSpecLimit" REAL,
    "target" REAL,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "direction" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CTQDefinition_processStepDefinitionId_fkey" FOREIGN KEY ("processStepDefinitionId") REFERENCES "ProcessStepDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "processStepExecutionId" INTEGER NOT NULL,
    "ctqDefinitionId" INTEGER NOT NULL,
    "value" REAL NOT NULL,
    "rawData" JSONB,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Measurement_processStepExecutionId_fkey" FOREIGN KEY ("processStepExecutionId") REFERENCES "ProcessStepExecution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Measurement_ctqDefinitionId_fkey" FOREIGN KEY ("ctqDefinitionId") REFERENCES "CTQDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "fixtureType" TEXT NOT NULL,
    "stationCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastCalibratedAt" DATETIME,
    "calibrationDueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rootCauseCategory" TEXT NOT NULL,
    "effectivenessTag" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "affectedSteps" JSONB,
    "affectedCtqs" JSONB,
    "affectedLots" JSONB,
    "beforeMetrics" JSONB,
    "afterMetrics" JSONB,
    "externalLinks" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_StepReworkTargets" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_StepReworkTargets_A_fkey" FOREIGN KEY ("A") REFERENCES "ProcessStepDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_StepReworkTargets_B_fkey" FOREIGN KEY ("B") REFERENCES "ProcessStepDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_serial_key" ON "Unit"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_kitId_key" ON "Unit"("kitId");

-- CreateIndex
CREATE INDEX "Unit_kitId_idx" ON "Unit"("kitId");

-- CreateIndex
CREATE UNIQUE INDEX "Kit_code_key" ON "Kit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentLot_lotNumber_key" ON "ComponentLot"("lotNumber");

-- CreateIndex
CREATE INDEX "KitComponentLot_componentLotId_idx" ON "KitComponentLot"("componentLotId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessStepDefinition_code_key" ON "ProcessStepDefinition"("code");

-- CreateIndex
CREATE INDEX "ProcessStepExecution_unitId_idx" ON "ProcessStepExecution"("unitId");

-- CreateIndex
CREATE INDEX "ProcessStepExecution_stepDefinitionId_idx" ON "ProcessStepExecution"("stepDefinitionId");

-- CreateIndex
CREATE INDEX "ProcessStepExecution_fixtureId_idx" ON "ProcessStepExecution"("fixtureId");

-- CreateIndex
CREATE INDEX "ProcessStepExecution_reworkLoopId_idx" ON "ProcessStepExecution"("reworkLoopId");

-- CreateIndex
CREATE INDEX "ProcessStepExecution_originalFailureStepId_idx" ON "ProcessStepExecution"("originalFailureStepId");

-- CreateIndex
CREATE INDEX "CTQDefinition_processStepDefinitionId_idx" ON "CTQDefinition"("processStepDefinitionId");

-- CreateIndex
CREATE INDEX "Measurement_processStepExecutionId_idx" ON "Measurement"("processStepExecutionId");

-- CreateIndex
CREATE INDEX "Measurement_ctqDefinitionId_idx" ON "Measurement"("ctqDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_code_key" ON "Fixture"("code");

-- CreateIndex
CREATE UNIQUE INDEX "_StepReworkTargets_AB_unique" ON "_StepReworkTargets"("A", "B");

-- CreateIndex
CREATE INDEX "_StepReworkTargets_B_index" ON "_StepReworkTargets"("B");
