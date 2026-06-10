-- CreateTable
CREATE TABLE "WeatherCache" (
    "key" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "days" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'open-meteo',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("key")
);
