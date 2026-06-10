import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

/**
 * Data export (Phase 5, "own your data"). Dumps everything the account owns —
 * gardens, beds, seasons, planting records, soil amendments, and any custom
 * plant-directory entries — as a single JSON document, including archived rows
 * so nothing is lost. Import is a separate, later endpoint.
 *
 * The response is intentionally schema-less (default JSON serialisation) so the
 * full nested document passes through untouched.
 */
export const exportRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['data'],
        summary: 'Export all of the account’s data as JSON',
        security: [{ bearerAuth: [] }],
        response: { 401: Type.Ref('Error') },
      },
    },
    async (request) => {
      const ownerId = request.user.sub;
      const [account, gardens, beds, seasons, plantings, amendments, customPlants] =
        await Promise.all([
          app.prisma.user.findUnique({
            where: { id: ownerId },
            select: {
              email: true,
              displayName: true,
              unitSystem: true,
              zipCode: true,
              hardinessZone: true,
              zoneIsManual: true,
              latitude: true,
              longitude: true,
            },
          }),
          app.prisma.garden.findMany({ where: { ownerId } }),
          app.prisma.bed.findMany({ where: { garden: { ownerId } } }),
          app.prisma.season.findMany({ where: { ownerId } }),
          app.prisma.plantingRecord.findMany({
            where: { bed: { garden: { ownerId } } },
            include: { plant: { select: { slug: true } } },
          }),
          app.prisma.soilAmendment.findMany({ where: { bed: { garden: { ownerId } } } }),
          app.prisma.plant.findMany({ where: { ownerId } }),
        ]);

      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        account,
        gardens,
        beds,
        seasons,
        // Carry the plant slug so the dump is portable / human-readable.
        plantings: plantings.map(({ plant, ...rest }) => ({ ...rest, plantSlug: plant.slug })),
        amendments,
        customPlants,
      };
    },
  );
};
