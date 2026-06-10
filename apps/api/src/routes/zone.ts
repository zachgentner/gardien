import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  resolveZone,
  fetchPhzmapi,
  normalizeZip,
  InvalidZipError,
  ZoneUnavailableError,
  type ResolveZoneDeps,
  type ZoneData,
} from '../services/hardinessZone.js';

const ZoneResult = Type.Object({
  zip: Type.String(),
  hardinessZone: Type.String(),
  latitude: Type.Union([Type.Number(), Type.Null()]),
  longitude: Type.Union([Type.Number(), Type.Null()]),
  temperatureRange: Type.Union([Type.String(), Type.Null()]),
  source: Type.Union([
    Type.Literal('api'),
    Type.Literal('cache'),
    Type.Literal('stale-cache'),
  ]),
});

const AccountLocation = Type.Object({
  zipCode: Type.Union([Type.String(), Type.Null()]),
  hardinessZone: Type.Union([Type.String(), Type.Null()]),
  zoneIsManual: Type.Boolean(),
  latitude: Type.Union([Type.Number(), Type.Null()]),
  longitude: Type.Union([Type.Number(), Type.Null()]),
});

const LookupQuery = Type.Object({
  zip: Type.String({ minLength: 5, maxLength: 10 }),
});

// Set the account's zone, either by ZIP (auto lookup) or a manual override.
const SetLocationBody = Type.Object({
  zip: Type.Optional(Type.String({ minLength: 5, maxLength: 10 })),
  // Providing a zone explicitly flags it as a manual override (microclimates).
  hardinessZone: Type.Optional(Type.String({ minLength: 1, maxLength: 8 })),
  latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
  longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
});

export const zoneRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // Prisma- and network-backed dependencies for the pure resolver.
  const deps: ResolveZoneDeps = {
    getCache: async (zip) => {
      const row = await app.prisma.zoneLookupCache.findUnique({ where: { zip } });
      if (!row) return null;
      return {
        zip: row.zip,
        hardinessZone: row.hardinessZone,
        latitude: row.latitude,
        longitude: row.longitude,
        temperatureRange: row.temperatureRange,
        fetchedAt: row.fetchedAt,
      };
    },
    saveCache: async (data: ZoneData) => {
      await app.prisma.zoneLookupCache.upsert({
        where: { zip: data.zip },
        create: { ...data, source: 'phzmapi', fetchedAt: new Date() },
        update: { ...data, fetchedAt: new Date() },
      });
    },
    fetchUpstream: (zip) => fetchPhzmapi(zip),
  };

  app.get(
    '/lookup',
    {
      schema: {
        tags: ['zone'],
        summary: 'Look up the USDA hardiness zone for a ZIP (cached, degrades gracefully)',
        security: [{ bearerAuth: [] }],
        querystring: LookupQuery,
        response: {
          200: ZoneResult,
          400: Type.Ref('Error'),
          401: Type.Ref('Error'),
          503: Type.Ref('Error'),
        },
      },
    },
    async (request, reply) => {
      try {
        return await resolveZone(request.query.zip, deps);
      } catch (err) {
        if (err instanceof InvalidZipError) return reply.badRequest(err.message);
        if (err instanceof ZoneUnavailableError) return reply.serviceUnavailable(err.message);
        throw err;
      }
    },
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['zone'],
        summary: "Get the account's saved location & hardiness zone",
        security: [{ bearerAuth: [] }],
        response: { 200: AccountLocation, 401: Type.Ref('Error') },
      },
    },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
      if (!user) return reply.unauthorized('Account no longer exists.');
      return pickLocation(user);
    },
  );

  app.put(
    '/',
    {
      schema: {
        tags: ['zone'],
        summary: "Set the account's zone — by ZIP (auto lookup) or manual override",
        description:
          'Provide `hardinessZone` to set a manual override, or `zip` to derive the zone from a lookup. Manual values are never overwritten by a later ZIP change unless you send a new zip without a zone.',
        security: [{ bearerAuth: [] }],
        body: SetLocationBody,
        response: {
          200: AccountLocation,
          400: Type.Ref('Error'),
          401: Type.Ref('Error'),
          503: Type.Ref('Error'),
        },
      },
    },
    async (request, reply) => {
      const { zip, hardinessZone, latitude, longitude } = request.body;

      if (!zip && !hardinessZone) {
        return reply.badRequest('Provide a `zip` to look up, or a `hardinessZone` to set manually.');
      }

      const data: {
        zipCode?: string | null;
        hardinessZone?: string;
        zoneIsManual?: boolean;
        latitude?: number | null;
        longitude?: number | null;
      } = {};

      if (hardinessZone) {
        // Explicit manual override.
        data.hardinessZone = hardinessZone;
        data.zoneIsManual = true;
        if (zip) data.zipCode = normalizeZip(zip) ?? zip;
        if (latitude !== undefined) data.latitude = latitude;
        if (longitude !== undefined) data.longitude = longitude;
      } else if (zip) {
        // Derive the zone from a ZIP lookup.
        try {
          const result = await resolveZone(zip, deps);
          data.zipCode = result.zip;
          data.hardinessZone = result.hardinessZone;
          data.zoneIsManual = false;
          data.latitude = result.latitude;
          data.longitude = result.longitude;
        } catch (err) {
          if (err instanceof InvalidZipError) return reply.badRequest(err.message);
          if (err instanceof ZoneUnavailableError) return reply.serviceUnavailable(err.message);
          throw err;
        }
      }

      const user = await app.prisma.user.update({ where: { id: request.user.sub }, data });
      return pickLocation(user);
    },
  );
};

function pickLocation(user: {
  zipCode: string | null;
  hardinessZone: string | null;
  zoneIsManual: boolean;
  latitude: number | null;
  longitude: number | null;
}) {
  return {
    zipCode: user.zipCode,
    hardinessZone: user.hardinessZone,
    zoneIsManual: user.zoneIsManual,
    latitude: user.latitude,
    longitude: user.longitude,
  };
}
