import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { IdParam, Timestamps, errorResponses } from '../schemas/common.js';

const PlantTypeEnum = Type.Union([
  Type.Literal('vegetable'),
  Type.Literal('fruit'),
  Type.Literal('herb'),
  Type.Literal('flower'),
  Type.Literal('cover_crop'),
]);

const Family = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  rotationGroup: Type.Union([Type.String(), Type.Null()]),
  source: Type.Union([Type.String(), Type.Null()]),
  ...Timestamps,
});

const Plant = Type.Object({
  id: Type.String(),
  commonName: Type.String(),
  scientificName: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
  type: PlantTypeEnum,
  sun: Type.Union([Type.String(), Type.Null()]),
  water: Type.Union([Type.String(), Type.Null()]),
  feederType: Type.Union([Type.String(), Type.Null()]),
  spacingMm: Type.Union([Type.Integer(), Type.Null()]),
  rowSpacingMm: Type.Union([Type.Integer(), Type.Null()]),
  daysToMaturityMin: Type.Union([Type.Integer(), Type.Null()]),
  daysToMaturityMax: Type.Union([Type.Integer(), Type.Null()]),
  soilNotes: Type.Union([Type.String(), Type.Null()]),
  growingTips: Type.Union([Type.String(), Type.Null()]),
  commonMistakes: Type.Union([Type.String(), Type.Null()]),
  source: Type.Union([Type.String(), Type.Null()]),
  familyId: Type.Union([Type.String(), Type.Null()]),
  ...Timestamps,
});

const PlantSearchQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 120 })),
  type: Type.Optional(PlantTypeEnum),
  familyId: Type.Optional(Type.String()),
  take: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  skip: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});

export const plantRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/families',
    {
      schema: {
        tags: ['plants'],
        summary: 'List plant families (drive rotation/disease rules)',
        security: [{ bearerAuth: [] }],
        response: { 200: Type.Array(Family), ...errorResponses },
      },
    },
    async () => app.prisma.plantFamily.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['plants'],
        summary: 'Search the plant directory',
        security: [{ bearerAuth: [] }],
        querystring: PlantSearchQuery,
        response: { 200: Type.Array(Plant), ...errorResponses },
      },
    },
    async (request) => {
      const { q, type, familyId, take, skip } = request.query;
      return app.prisma.plant.findMany({
        where: {
          deletedAt: null,
          ...(type ? { type } : {}),
          ...(familyId ? { familyId } : {}),
          ...(q
            ? {
                OR: [
                  { commonName: { contains: q, mode: 'insensitive' } },
                  { scientificName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { commonName: 'asc' },
        take,
        skip,
      });
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['plants'],
        summary: 'Get a plant with its companion relationships',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: {
          200: Type.Intersect([
            Plant,
            Type.Object({
              companions: Type.Array(
                Type.Object({
                  plantId: Type.String(),
                  relation: Type.String(),
                  reason: Type.Union([Type.String(), Type.Null()]),
                }),
              ),
            }),
          ]),
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const plant = await app.prisma.plant.findFirst({
        where: { id: request.params.id, deletedAt: null },
        include: { companionsFrom: true, companionsTo: true },
      });
      if (!plant) return reply.notFound('Plant not found.');

      const companions = [
        ...plant.companionsFrom.map((c) => ({
          plantId: c.plantBId,
          relation: c.relation,
          reason: c.reason,
        })),
        ...plant.companionsTo.map((c) => ({
          plantId: c.plantAId,
          relation: c.relation,
          reason: c.reason,
        })),
      ];

      const { companionsFrom: _f, companionsTo: _t, ...rest } = plant;
      return { ...rest, companions };
    },
  );
};
