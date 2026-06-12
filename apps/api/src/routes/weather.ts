import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { Prisma } from '@prisma/client';
import { errorResponses } from '../schemas/common.js';
import {
  resolveForecast,
  fetchOpenMeteo,
  WeatherUnavailableError,
  type ForecastDay,
} from '../services/weather.js';
import { frostWarnings } from '../domain/frost.js';

const ForecastDaySchema = Type.Object({
  date: Type.String(),
  tempMinC: Type.Union([Type.Number(), Type.Null()]),
  tempMaxC: Type.Union([Type.Number(), Type.Null()]),
  precipMm: Type.Union([Type.Number(), Type.Null()]),
});

const FrostWarningSchema = Type.Object({
  date: Type.String(),
  tempMinC: Type.Number(),
  severity: Type.Union([Type.Literal('frost'), Type.Literal('light-frost')]),
});

const PestWatchSchema = Type.Object({
  plantName: Type.String(),
  name: Type.String(),
  kind: Type.Union([Type.Literal('pest'), Type.Literal('disease')]),
  management: Type.Union([Type.String(), Type.Null()]),
});

/**
 * Weather-driven alerts for the dashboard (Phase 6): a localized forecast for
 * the account's coordinates, frost warnings derived from it, and a pest/disease
 * "watch" list built from what the account is currently growing.
 */
const WeatherResponse = Type.Object({
  located: Type.Boolean(),
  latitude: Type.Union([Type.Number(), Type.Null()]),
  longitude: Type.Union([Type.Number(), Type.Null()]),
  source: Type.Union([
    Type.Literal('api'),
    Type.Literal('cache'),
    Type.Literal('stale-cache'),
    Type.Null(),
  ]),
  forecast: Type.Array(ForecastDaySchema),
  frostWarnings: Type.Array(FrostWarningSchema),
  pestWatch: Type.Array(PestWatchSchema),
});

export const weatherRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['weather'],
        summary: 'Localized forecast, frost warnings, and pest/disease watch',
        security: [{ bearerAuth: [] }],
        response: { 200: WeatherResponse, ...errorResponses },
      },
    },
    async (request) => {
      const ownerId = request.user.sub;
      const [user, plantings] = await Promise.all([
        app.prisma.user.findUnique({
          where: { id: ownerId },
          select: { latitude: true, longitude: true },
        }),
        app.prisma.plantingRecord.findMany({
          where: {
            bed: { garden: { ownerId } },
            deletedAt: null,
            status: { in: ['planned', 'planted'] },
          },
          include: {
            plant: {
              select: {
                commonName: true,
                issues: {
                  where: { deletedAt: null },
                  select: { name: true, kind: true, management: true },
                },
              },
            },
          },
        }),
      ]);

      // Pest/disease watch: the issues of everything currently growing, deduped.
      const seen = new Set<string>();
      const pestWatch: Static<typeof PestWatchSchema>[] = [];
      for (const p of plantings) {
        for (const issue of p.plant.issues) {
          const key = `${p.plant.commonName}|${issue.name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pestWatch.push({
            plantName: p.plant.commonName,
            name: issue.name,
            kind: issue.kind as 'pest' | 'disease',
            management: issue.management,
          });
        }
      }

      const latitude = user?.latitude ?? null;
      const longitude = user?.longitude ?? null;
      if (latitude === null || longitude === null) {
        return { located: false, latitude, longitude, source: null, forecast: [], frostWarnings: [], pestWatch };
      }

      try {
        const result = await resolveForecast(latitude, longitude, {
          getCache: async (key) => {
            const row = await app.prisma.weatherCache.findUnique({ where: { key } });
            return row
              ? {
                  latitude: row.latitude,
                  longitude: row.longitude,
                  days: row.days as unknown as ForecastDay[],
                  fetchedAt: row.fetchedAt,
                }
              : null;
          },
          saveCache: async (key, forecast) => {
            const days = forecast.days as unknown as Prisma.InputJsonValue;
            await app.prisma.weatherCache.upsert({
              where: { key },
              update: { latitude: forecast.latitude, longitude: forecast.longitude, days, fetchedAt: new Date() },
              create: { key, latitude: forecast.latitude, longitude: forecast.longitude, days },
            });
          },
          fetchUpstream: (lat, lon) => fetchOpenMeteo(lat, lon),
        });

        return {
          located: true,
          latitude,
          longitude,
          source: result.source,
          forecast: result.days,
          frostWarnings: frostWarnings(result.days),
          pestWatch,
        };
      } catch (err) {
        if (err instanceof WeatherUnavailableError) {
          // Location is set, but we can't reach weather and have no cache.
          return { located: true, latitude, longitude, source: null, forecast: [], frostWarnings: [], pestWatch };
        }
        throw err;
      }
    },
  );
};
