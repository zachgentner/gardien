import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { IdParam, ListQuery, Timestamps, NullableDateTime, errorResponses } from '../schemas/common.js';

const SeasonTypeEnum = Type.Union([
  Type.Literal('spring'),
  Type.Literal('summer'),
  Type.Literal('fall'),
  Type.Literal('winter'),
]);

const Season = Type.Object({
  id: Type.String(),
  name: Type.String(),
  seasonType: SeasonTypeEnum,
  year: Type.Integer(),
  startDate: NullableDateTime,
  endDate: NullableDateTime,
  isActive: Type.Boolean(),
  notes: Type.Union([Type.String(), Type.Null()]),
  ...Timestamps,
});

const SeasonCreate = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  seasonType: SeasonTypeEnum,
  year: Type.Integer({ minimum: 1900, maximum: 2200 }),
  startDate: Type.Optional(Type.String({ format: 'date-time' })),
  endDate: Type.Optional(Type.String({ format: 'date-time' })),
  isActive: Type.Optional(Type.Boolean()),
  notes: Type.Optional(Type.String({ maxLength: 2000 })),
});

const SeasonUpdate = Type.Partial(SeasonCreate);

export const seasonRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['seasons'],
        summary: 'List seasons',
        security: [{ bearerAuth: [] }],
        querystring: ListQuery,
        response: { 200: Type.Array(Season), ...errorResponses },
      },
    },
    async (request) => {
      const { includeArchived, take, skip } = request.query;
      return app.prisma.season.findMany({
        where: { ownerId: request.user.sub, ...(includeArchived ? {} : { deletedAt: null }) },
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      });
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['seasons'],
        summary: 'Create a season',
        security: [{ bearerAuth: [] }],
        body: SeasonCreate,
        response: { 201: Season, ...errorResponses },
      },
    },
    async (request, reply) => {
      const season = await app.prisma.season.create({
        data: { ...request.body, ownerId: request.user.sub },
      });
      return reply.code(201).send(season);
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['seasons'],
        summary: 'Get a season',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Season, ...errorResponses },
      },
    },
    async (request, reply) => {
      const season = await app.prisma.season.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!season) return reply.notFound('Season not found.');
      return season;
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['seasons'],
        summary: 'Update a season',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: SeasonUpdate,
        response: { 200: Season, ...errorResponses },
      },
    },
    async (request, reply) => {
      const owned = await app.prisma.season.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!owned) return reply.notFound('Season not found.');
      return app.prisma.season.update({ where: { id: owned.id }, data: request.body });
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['seasons'],
        summary: 'Archive (soft-delete) a season',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Season, ...errorResponses },
      },
    },
    async (request, reply) => {
      const owned = await app.prisma.season.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!owned) return reply.notFound('Season not found.');
      return app.prisma.season.update({
        where: { id: owned.id },
        data: { deletedAt: owned.deletedAt ?? new Date() },
      });
    },
  );
};
