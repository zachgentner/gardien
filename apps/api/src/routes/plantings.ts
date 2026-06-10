import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { IdParam, Timestamps, NullableDateTime, errorResponses } from '../schemas/common.js';

const StatusEnum = Type.Union([
  Type.Literal('planned'),
  Type.Literal('planted'),
  Type.Literal('harvested'),
  Type.Literal('removed'),
]);

const Planting = Type.Object({
  id: Type.String(),
  quantity: Type.Integer(),
  status: StatusEnum,
  plannedPlantDate: NullableDateTime,
  plannedHarvestDate: NullableDateTime,
  plantedOn: NullableDateTime,
  harvestedOn: NullableDateTime,
  notes: Type.Union([Type.String(), Type.Null()]),
  bedId: Type.String(),
  plantId: Type.String(),
  seasonId: Type.String(),
  ...Timestamps,
});

const PlantingCreate = Type.Object({
  bedId: Type.String({ minLength: 1 }),
  plantId: Type.String({ minLength: 1 }),
  seasonId: Type.String({ minLength: 1 }),
  quantity: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  status: Type.Optional(StatusEnum),
  plannedPlantDate: Type.Optional(Type.String({ format: 'date-time' })),
  plannedHarvestDate: Type.Optional(Type.String({ format: 'date-time' })),
  plantedOn: Type.Optional(Type.String({ format: 'date-time' })),
  harvestedOn: Type.Optional(Type.String({ format: 'date-time' })),
  notes: Type.Optional(Type.String({ maxLength: 2000 })),
});

const PlantingUpdate = Type.Partial(Type.Omit(PlantingCreate, ['bedId', 'plantId', 'seasonId']));

const ListPlantingsQuery = Type.Object({
  bedId: Type.Optional(Type.String()),
  seasonId: Type.Optional(Type.String()),
  includeArchived: Type.Optional(Type.Boolean({ default: false })),
});

export const plantingRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  const ownsBed = (bedId: string, userId: string) =>
    app.prisma.bed.findFirst({ where: { id: bedId, garden: { ownerId: userId } } });
  const ownsSeason = (seasonId: string, userId: string) =>
    app.prisma.season.findFirst({ where: { id: seasonId, ownerId: userId } });

  app.get(
    '/',
    {
      schema: {
        tags: ['plantings'],
        summary: 'List planting records (filter by bed and/or season)',
        security: [{ bearerAuth: [] }],
        querystring: ListPlantingsQuery,
        response: { 200: Type.Array(Planting), ...errorResponses },
      },
    },
    async (request) => {
      const { bedId, seasonId, includeArchived } = request.query;
      return app.prisma.plantingRecord.findMany({
        where: {
          bed: { garden: { ownerId: request.user.sub } },
          ...(bedId ? { bedId } : {}),
          ...(seasonId ? { seasonId } : {}),
          ...(includeArchived ? {} : { deletedAt: null }),
        },
        orderBy: { createdAt: 'desc' },
      });
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['plantings'],
        summary: 'Create a planting record',
        security: [{ bearerAuth: [] }],
        body: PlantingCreate,
        response: { 201: Planting, ...errorResponses },
      },
    },
    async (request, reply) => {
      const { bedId, plantId, seasonId } = request.body;
      const [bed, season, plant] = await Promise.all([
        ownsBed(bedId, request.user.sub),
        ownsSeason(seasonId, request.user.sub),
        app.prisma.plant.findFirst({ where: { id: plantId, deletedAt: null } }),
      ]);
      if (!bed) return reply.notFound('Bed not found.');
      if (!season) return reply.notFound('Season not found.');
      if (!plant) return reply.notFound('Plant not found.');

      const planting = await app.prisma.plantingRecord.create({ data: request.body });
      return reply.code(201).send(planting);
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['plantings'],
        summary: 'Get a planting record',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Planting, ...errorResponses },
      },
    },
    async (request, reply) => {
      const planting = await app.prisma.plantingRecord.findFirst({
        where: { id: request.params.id, bed: { garden: { ownerId: request.user.sub } } },
      });
      if (!planting) return reply.notFound('Planting record not found.');
      return planting;
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['plantings'],
        summary: 'Update a planting record (e.g. plan → planted → harvested)',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: PlantingUpdate,
        response: { 200: Planting, ...errorResponses },
      },
    },
    async (request, reply) => {
      const planting = await app.prisma.plantingRecord.findFirst({
        where: { id: request.params.id, bed: { garden: { ownerId: request.user.sub } } },
      });
      if (!planting) return reply.notFound('Planting record not found.');
      return app.prisma.plantingRecord.update({ where: { id: planting.id }, data: request.body });
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['plantings'],
        summary: 'Soft-delete a planting record',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Planting, ...errorResponses },
      },
    },
    async (request, reply) => {
      const planting = await app.prisma.plantingRecord.findFirst({
        where: { id: request.params.id, bed: { garden: { ownerId: request.user.sub } } },
      });
      if (!planting) return reply.notFound('Planting record not found.');
      return app.prisma.plantingRecord.update({
        where: { id: planting.id },
        data: { deletedAt: planting.deletedAt ?? new Date() },
      });
    },
  );
};
