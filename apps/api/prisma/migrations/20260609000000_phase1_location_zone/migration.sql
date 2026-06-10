-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hardinessZone" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "zipCode" TEXT,
ADD COLUMN     "zoneIsManual" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ZoneLookupCache" (
    "zip" TEXT NOT NULL,
    "hardinessZone" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "temperatureRange" TEXT,
    "source" TEXT NOT NULL DEFAULT 'phzmapi',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneLookupCache_pkey" PRIMARY KEY ("zip")
);

