import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { IdParam, ListQuery, Timestamps, errorResponses } from '../schemas/common.js';
import { withinLimit, planLimit, type Plan } from '../domain/plan.js';

const Garden = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  latitude: Type.Union([Type.Number(), Type.Null()]),
  longitude: Type.Union([Type.Number(), Type.Null()]),
  hardinessZone: Type.Union([Type.String(), Type.Null()]),
  ...Timestamps,
});

const GardenCreate = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
  longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
  hardinessZone: Type.Optional(Type.String({ maxLength: 8 })),
});

const GardenUpdate = Type.Partial(GardenCreate);

export const gardenRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['gardens'],
        summary: 'List the current user’s gardens',
        security: [{ bearerAuth: [] }],
        querystring: ListQuery,
        response: { 200: Type.Array(Garden), ...errorResponses },
      },
    },
    async (request) => {
      const { includeArchived, take, skip } = request.query;
      return app.prisma.garden.findMany({
        where: { ownerId: request.user.sub, ...(includeArchived ? {} : { deletedAt: null }) },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['gardens'],
        summary: 'Create a garden',
        security: [{ bearerAuth: [] }],
        body: GardenCreate,
        response: { 201: Garden, ...errorResponses },
      },
    },
    async (request, reply) => {
      const [user, count] = await Promise.all([
        app.prisma.user.findUnique({ where: { id: request.user.sub }, select: { plan: true } }),
        app.prisma.garden.count({ where: { ownerId: request.user.sub, deletedAt: null } }),
      ]);
      const plan = (user?.plan ?? 'free') as Plan;
      if (!withinLimit(plan, 'gardens', count)) {
        return reply.forbidden(
          `Your plan allows up to ${planLimit(plan, 'gardens')} gardens. Upgrade to add more.`,
        );
      }
      const garden = await app.prisma.garden.create({
        data: { ...request.body, ownerId: request.user.sub },
      });
      return reply.code(201).send(garden);
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['gardens'],
        summary: 'Get a garden',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Garden, ...errorResponses },
      },
    },
    async (request, reply) => {
      const garden = await app.prisma.garden.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!garden) return reply.notFound('Garden not found.');
      return garden;
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['gardens'],
        summary: 'Update a garden',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: GardenUpdate,
        response: { 200: Garden, ...errorResponses },
      },
    },
    async (request, reply) => {
      const owned = await app.prisma.garden.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!owned) return reply.notFound('Garden not found.');
      return app.prisma.garden.update({ where: { id: owned.id }, data: request.body });
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['gardens'],
        summary: 'Archive (soft-delete) a garden — history is preserved',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Garden, ...errorResponses },
      },
    },
    async (request, reply) => {
      const owned = await app.prisma.garden.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!owned) return reply.notFound('Garden not found.');
      return app.prisma.garden.update({
        where: { id: owned.id },
        data: { deletedAt: owned.deletedAt ?? new Date() },
      });
    },
  );
};
