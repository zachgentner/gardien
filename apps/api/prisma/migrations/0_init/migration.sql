-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('metric', 'imperial');

-- CreateEnum
CREATE TYPE "PlantType" AS ENUM ('vegetable', 'fruit', 'herb', 'flower', 'cover_crop');

-- CreateEnum
CREATE TYPE "SunRequirement" AS ENUM ('full_sun', 'partial_sun', 'partial_shade', 'full_shade');

-- CreateEnum
CREATE TYPE "WaterRequirement" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "FeederType" AS ENUM ('heavy', 'medium', 'light', 'fixer');

-- CreateEnum
CREATE TYPE "CompanionRelation" AS ENUM ('companion', 'antagonist');

-- CreateEnum
CREATE TYPE "BedType" AS ENUM ('raised_bed', 'in_ground', 'container', 'greenhouse');

-- CreateEnum
CREATE TYPE "SeasonType" AS ENUM ('spring', 'summer', 'fall', 'winter');

-- CreateEnum
CREATE TYPE "PlantingStatus" AS ENUM ('planned', 'planted', 'harvested', 'removed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "unitSystem" "UnitSystem" NOT NULL DEFAULT 'imperial',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "rotationGroup" TEXT,
    "source" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlantFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "scientificName" TEXT,
    "slug" TEXT NOT NULL,
    "type" "PlantType" NOT NULL,
    "sun" "SunRequirement",
    "water" "WaterRequirement",
    "feederType" "FeederType",
    "spacingMm" INTEGER,
    "rowSpacingMm" INTEGER,
    "daysToMaturityMin" INTEGER,
    "daysToMaturityMax" INTEGER,
    "soilNotes" TEXT,
    "growingTips" TEXT,
    "commonMistakes" TEXT,
    "source" TEXT,
    "familyId" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionLink" (
    "id" TEXT NOT NULL,
    "plantAId" TEXT NOT NULL,
    "plantBId" TEXT NOT NULL,
    "relation" "CompanionRelation" NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanionLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garden" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "hardinessZone" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Garden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bedType" "BedType" NOT NULL DEFAULT 'raised_bed',
    "location" TEXT,
    "soilType" TEXT,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "areaSqM" DOUBLE PRECISION,
    "gardenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seasonType" "SeasonType" NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantingRecord" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "PlantingStatus" NOT NULL DEFAULT 'planned',
    "plannedPlantDate" TIMESTAMP(3),
    "plannedHarvestDate" TIMESTAMP(3),
    "plantedOn" TIMESTAMP(3),
    "harvestedOn" TIMESTAMP(3),
    "notes" TEXT,
    "bedId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlantingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilAmendment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION,
    "amountUnit" TEXT,
    "notes" TEXT,
    "bedId" TEXT NOT NULL,
    "seasonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SoilAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlantFamily_slug_key" ON "PlantFamily"("slug");

-- CreateIndex
CREATE INDEX "PlantFamily_deletedAt_idx" ON "PlantFamily"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_slug_key" ON "Plant"("slug");

-- CreateIndex
CREATE INDEX "Plant_type_idx" ON "Plant"("type");

-- CreateIndex
CREATE INDEX "Plant_familyId_idx" ON "Plant"("familyId");

-- CreateIndex
CREATE INDEX "Plant_deletedAt_idx" ON "Plant"("deletedAt");

-- CreateIndex
CREATE INDEX "CompanionLink_plantAId_idx" ON "CompanionLink"("plantAId");

-- CreateIndex
CREATE INDEX "CompanionLink_plantBId_idx" ON "CompanionLink"("plantBId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionLink_plantAId_plantBId_relation_key" ON "CompanionLink"("plantAId", "plantBId", "relation");

-- CreateIndex
CREATE INDEX "Garden_ownerId_idx" ON "Garden"("ownerId");

-- CreateIndex
CREATE INDEX "Garden_deletedAt_idx" ON "Garden"("deletedAt");

-- CreateIndex
CREATE INDEX "Bed_gardenId_idx" ON "Bed"("gardenId");

-- CreateIndex
CREATE INDEX "Bed_deletedAt_idx" ON "Bed"("deletedAt");

-- CreateIndex
CREATE INDEX "Season_ownerId_idx" ON "Season"("ownerId");

-- CreateIndex
CREATE INDEX "Season_year_idx" ON "Season"("year");

-- CreateIndex
CREATE INDEX "Season_deletedAt_idx" ON "Season"("deletedAt");

-- CreateIndex
CREATE INDEX "PlantingRecord_bedId_idx" ON "PlantingRecord"("bedId");

-- CreateIndex
CREATE INDEX "PlantingRecord_plantId_idx" ON "PlantingRecord"("plantId");

-- CreateIndex
CREATE INDEX "PlantingRecord_seasonId_idx" ON "PlantingRecord"("seasonId");

-- CreateIndex
CREATE INDEX "PlantingRecord_deletedAt_idx" ON "PlantingRecord"("deletedAt");

-- CreateIndex
CREATE INDEX "SoilAmendment_bedId_idx" ON "SoilAmendment"("bedId");

-- CreateIndex
CREATE INDEX "SoilAmendment_seasonId_idx" ON "SoilAmendment"("seasonId");

-- CreateIndex
CREATE INDEX "SoilAmendment_deletedAt_idx" ON "SoilAmendment"("deletedAt");

-- AddForeignKey
ALTER TABLE "PlantFamily" ADD CONSTRAINT "PlantFamily_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "PlantFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanionLink" ADD CONSTRAINT "CompanionLink_plantAId_fkey" FOREIGN KEY ("plantAId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanionLink" ADD CONSTRAINT "CompanionLink_plantBId_fkey" FOREIGN KEY ("plantBId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garden" ADD CONSTRAINT "Garden_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "Garden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingRecord" ADD CONSTRAINT "PlantingRecord_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingRecord" ADD CONSTRAINT "PlantingRecord_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingRecord" ADD CONSTRAINT "PlantingRecord_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAmendment" ADD CONSTRAINT "SoilAmendment_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAmendment" ADD CONSTRAINT "SoilAmendment_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

