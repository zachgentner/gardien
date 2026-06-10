-- CreateEnum
CREATE TYPE "PlantIssueKind" AS ENUM ('pest', 'disease');

-- CreateTable
CREATE TABLE "PlantIssue" (
    "id" TEXT NOT NULL,
    "kind" "PlantIssueKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "management" TEXT,
    "source" TEXT,
    "plantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlantIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantingWindow" (
    "id" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "plantStartMonth" INTEGER NOT NULL,
    "plantEndMonth" INTEGER NOT NULL,
    "harvestStartMonth" INTEGER,
    "harvestEndMonth" INTEGER,
    "source" TEXT,
    "notes" TEXT,
    "plantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlantingWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantIssue_plantId_idx" ON "PlantIssue"("plantId");

-- CreateIndex
CREATE INDEX "PlantIssue_deletedAt_idx" ON "PlantIssue"("deletedAt");

-- CreateIndex
CREATE INDEX "PlantingWindow_plantId_idx" ON "PlantingWindow"("plantId");

-- CreateIndex
CREATE INDEX "PlantingWindow_zone_idx" ON "PlantingWindow"("zone");

-- CreateIndex
CREATE INDEX "PlantingWindow_deletedAt_idx" ON "PlantingWindow"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlantingWindow_plantId_zone_ownerId_key" ON "PlantingWindow"("plantId", "zone", "ownerId");

-- AddForeignKey
ALTER TABLE "PlantIssue" ADD CONSTRAINT "PlantIssue_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingWindow" ADD CONSTRAINT "PlantingWindow_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

