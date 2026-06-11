-- CreateTable
CREATE TABLE "IrrigationConfig" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "thresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "requestedRunMs" INTEGER NOT NULL DEFAULT 120000,
    "maxRunMs" INTEGER NOT NULL DEFAULT 300000,
    "minIntervalMs" INTEGER NOT NULL DEFAULT 21600000,
    "staleAfterMs" INTEGER NOT NULL DEFAULT 7200000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IrrigationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrigationRun" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "runMs" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "soilMoisturePct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrrigationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IrrigationConfig_deviceId_key" ON "IrrigationConfig"("deviceId");

-- CreateIndex
CREATE INDEX "IrrigationRun_deviceId_startedAt_idx" ON "IrrigationRun"("deviceId", "startedAt");

-- AddForeignKey
ALTER TABLE "IrrigationConfig" ADD CONSTRAINT "IrrigationConfig_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationRun" ADD CONSTRAINT "IrrigationRun_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
