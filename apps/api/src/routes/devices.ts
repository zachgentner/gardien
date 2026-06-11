import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyRequest } from 'fastify';
import { IdParam, Timestamps, DateTime, NullableDateTime, errorResponses } from '../schemas/common.js';
import { decideIrrigation } from '../domain/irrigation.js';

const SensorMetricEnum = Type.Union([
  Type.Literal('air_temp'),
  Type.Literal('humidity'),
  Type.Literal('soil_moisture'),
  Type.Literal('water_level'),
  Type.Literal('light'),
]);

const Device = Type.Object({
  id: Type.String(),
  name: Type.String(),
  bedId: Type.Union([Type.String(), Type.Null()]),
  batteryPct: Type.Union([Type.Number(), Type.Null()]),
  firmwareVersion: Type.Union([Type.String(), Type.Null()]),
  lastSeenAt: NullableDateTime,
  ...Timestamps,
});

/** Returned only when a token is minted (create / rotate) — shown once. */
const DeviceWithToken = Type.Intersect([Device, Type.Object({ token: Type.String() })]);

const DeviceCreate = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  bedId: Type.Optional(Type.String({ minLength: 1 })),
});
const DeviceUpdate = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  bedId: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  firmwareVersion: Type.Optional(Type.String({ maxLength: 40 })),
});

const Reading = Type.Object({
  id: Type.String(),
  metric: SensorMetricEnum,
  value: Type.Number(),
  unit: Type.String(),
  recordedAt: DateTime,
});

const ReadingInput = Type.Object({
  metric: SensorMetricEnum,
  value: Type.Number(),
  unit: Type.String({ maxLength: 16 }),
  recordedAt: Type.String({ format: 'date-time' }),
});

/** A buffered batch a device flushes when it reconnects, plus health fields. */
const IngestBody = Type.Object({
  batteryPct: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  firmwareVersion: Type.Optional(Type.String({ maxLength: 40 })),
  readings: Type.Array(ReadingInput, { maxItems: 500 }),
});

const ListReadingsQuery = Type.Object({
  metric: Type.Optional(SensorMetricEnum),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, default: 200 })),
});

const IrrigationConfigSchema = Type.Object({
  enabled: Type.Boolean(),
  thresholdPct: Type.Number(),
  requestedRunMs: Type.Integer(),
  maxRunMs: Type.Integer(),
  minIntervalMs: Type.Integer(),
  staleAfterMs: Type.Integer(),
});
const IrrigationConfigUpdate = Type.Partial(IrrigationConfigSchema);

const IrrigationDecisionSchema = Type.Object({
  irrigate: Type.Boolean(),
  runMs: Type.Integer(),
  reason: Type.String(),
  soilMoisturePct: Type.Union([Type.Number(), Type.Null()]),
});

const IrrigationRunSchema = Type.Object({
  id: Type.String(),
  startedAt: DateTime,
  endedAt: DateTime,
  runMs: Type.Integer(),
  reason: Type.String(),
  soilMoisturePct: Type.Union([Type.Number(), Type.Null()]),
});

const IrrigationStatus = Type.Object({
  config: IrrigationConfigSchema,
  decision: IrrigationDecisionSchema,
  recentRuns: Type.Array(IrrigationRunSchema),
});

const DEFAULT_CONFIG = {
  enabled: false,
  thresholdPct: 30,
  requestedRunMs: 120000,
  maxRunMs: 300000,
  minIntervalMs: 21600000,
  staleAfterMs: 7200000,
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function newSecret(): string {
  return randomBytes(24).toString('hex');
}
/** Constant-time compare of two hex digests. */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

interface ConfigShape {
  enabled: boolean;
  thresholdPct: number;
  requestedRunMs: number;
  maxRunMs: number;
  minIntervalMs: number;
  staleAfterMs: number;
}
function stripConfig(c: ConfigShape): ConfigShape {
  return {
    enabled: c.enabled,
    thresholdPct: c.thresholdPct,
    requestedRunMs: c.requestedRunMs,
    maxRunMs: c.maxRunMs,
    minIntervalMs: c.minIntervalMs,
    staleAfterMs: c.staleAfterMs,
  };
}

export const deviceRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const ownsBed = (bedId: string, userId: string) =>
    app.prisma.bed.findFirst({ where: { id: bedId, garden: { ownerId: userId } } });

  /** Resolve the device behind a `Bearer <deviceId>.<secret>` token, or null. */
  async function deviceFromToken(request: FastifyRequest) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const raw = auth.slice(7);
    const dot = raw.indexOf('.');
    if (dot < 1) return null;
    const id = raw.slice(0, dot);
    const secret = raw.slice(dot + 1);
    const device = await app.prisma.device.findFirst({ where: { id, deletedAt: null } });
    if (!device) return null;
    return safeEqualHex(sha256(secret), device.tokenHash) ? device : null;
  }

  // --- Device management (user-authenticated) -----------------------------

  app.get(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'List the account’s devices',
        security: [{ bearerAuth: [] }],
        response: { 200: Type.Array(Device), ...errorResponses },
      },
    },
    async (request) =>
      app.prisma.device.findMany({
        where: { ownerId: request.user.sub, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
  );

  app.post(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'Register a device (returns a one-time token)',
        security: [{ bearerAuth: [] }],
        body: DeviceCreate,
        response: { 201: DeviceWithToken, ...errorResponses },
      },
    },
    async (request, reply) => {
      if (request.body.bedId) {
        const bed = await ownsBed(request.body.bedId, request.user.sub);
        if (!bed) return reply.notFound('Bed not found.');
      }
      const secret = newSecret();
      const device = await app.prisma.device.create({
        data: {
          name: request.body.name,
          bedId: request.body.bedId ?? null,
          tokenHash: sha256(secret),
          ownerId: request.user.sub,
        },
      });
      return reply.code(201).send({ ...device, token: `${device.id}.${secret}` });
    },
  );

  app.get(
    '/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'Get a device',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Device, ...errorResponses },
      },
    },
    async (request, reply) => {
      const device = await app.prisma.device.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!device) return reply.notFound('Device not found.');
      return device;
    },
  );

  app.patch(
    '/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'Update a device',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: DeviceUpdate,
        response: { 200: Device, ...errorResponses },
      },
    },
    async (request, reply) => {
      const device = await app.prisma.device.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!device) return reply.notFound('Device not found.');
      if (request.body.bedId) {
        const bed = await ownsBed(request.body.bedId, request.user.sub);
        if (!bed) return reply.notFound('Bed not found.');
      }
      return app.prisma.device.update({ where: { id: device.id }, data: request.body });
    },
  );

  app.delete(
    '/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'Archive (soft-delete) a device',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Device, ...errorResponses },
      },
    },
    async (request, reply) => {
      const device = await app.prisma.device.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!device) return reply.notFound('Device not found.');
      return app.prisma.device.update({
        where: { id: device.id },
        data: { deletedAt: device.deletedAt ?? new Date() },
      });
    },
  );

  app.post(
    '/:id/rotate-token',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'Rotate a device’s token (returns the new one-time token)',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: DeviceWithToken, ...errorResponses },
      },
    },
    async (request, reply) => {
      const device = await app.prisma.device.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!device) return reply.notFound('Device not found.');
      const secret = newSecret();
      const updated = await app.prisma.device.update({
        where: { id: device.id },
        data: { tokenHash: sha256(secret) },
      });
      return { ...updated, token: `${updated.id}.${secret}` };
    },
  );

  app.get(
    '/:id/readings',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'List a device’s sensor readings (newest first)',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        querystring: ListReadingsQuery,
        response: { 200: Type.Array(Reading), ...errorResponses },
      },
    },
    async (request, reply) => {
      const device = await app.prisma.device.findFirst({
        where: { id: request.params.id, ownerId: request.user.sub },
      });
      if (!device) return reply.notFound('Device not found.');
      return app.prisma.sensorReading.findMany({
        where: { deviceId: device.id, ...(request.query.metric ? { metric: request.query.metric } : {}) },
        orderBy: { recordedAt: 'desc' },
        take: request.query.limit ?? 200,
      });
    },
  );

  // --- Irrigation control (user-authenticated) ----------------------------

  const ownsDevice = (id: string, userId: string) =>
    app.prisma.device.findFirst({ where: { id, ownerId: userId } });

  /** Evaluate the fail-safe rules for a device against its latest reading. */
  async function evaluateIrrigation(deviceId: string) {
    const [config, latest, lastRun] = await Promise.all([
      app.prisma.irrigationConfig.findUnique({ where: { deviceId } }),
      app.prisma.sensorReading.findFirst({
        where: { deviceId, metric: 'soil_moisture' },
        orderBy: { recordedAt: 'desc' },
      }),
      app.prisma.irrigationRun.findFirst({ where: { deviceId }, orderBy: { endedAt: 'desc' } }),
    ]);
    const cfg = config ?? DEFAULT_CONFIG;
    const soilMoisturePct = latest?.value ?? null;

    if (!cfg.enabled) {
      return {
        cfg,
        decision: { irrigate: false, runMs: 0, reason: 'Automatic irrigation is disabled.', soilMoisturePct },
      };
    }

    const now = Date.now();
    const sensorStale = !latest || now - latest.recordedAt.getTime() > cfg.staleAfterMs;
    const d = decideIrrigation({
      soilMoisturePct,
      thresholdPct: cfg.thresholdPct,
      sensorStale,
      lastRunEndedAt: lastRun?.endedAt.getTime() ?? null,
      minIntervalMs: cfg.minIntervalMs,
      maxRunMs: cfg.maxRunMs,
      requestedRunMs: cfg.requestedRunMs,
      now,
    });
    return { cfg, decision: { ...d, soilMoisturePct } };
  }

  app.get(
    '/:id/irrigation',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'Irrigation config, the current fail-safe decision, and recent runs',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: IrrigationStatus, ...errorResponses },
      },
    },
    async (request, reply) => {
      const device = await ownsDevice(request.params.id, request.user.sub);
      if (!device) return reply.notFound('Device not found.');
      const { cfg, decision } = await evaluateIrrigation(device.id);
      const recentRuns = await app.prisma.irrigationRun.findMany({
        where: { deviceId: device.id },
        orderBy: { startedAt: 'desc' },
        take: 10,
      });
      return { config: stripConfig(cfg), decision, recentRuns };
    },
  );

  app.put(
    '/:id/irrigation',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'Update a device’s irrigation policy',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: IrrigationConfigUpdate,
        response: { 200: IrrigationConfigSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const device = await ownsDevice(request.params.id, request.user.sub);
      if (!device) return reply.notFound('Device not found.');
      const saved = await app.prisma.irrigationConfig.upsert({
        where: { deviceId: device.id },
        update: request.body,
        create: { deviceId: device.id, ...DEFAULT_CONFIG, ...request.body },
      });
      return stripConfig(saved);
    },
  );

  app.post(
    '/:id/irrigate',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['devices'],
        summary: 'Run the fail-safe rules now; logs a run if irrigation is warranted',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: IrrigationDecisionSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const device = await ownsDevice(request.params.id, request.user.sub);
      if (!device) return reply.notFound('Device not found.');
      const { decision } = await evaluateIrrigation(device.id);
      if (decision.irrigate) {
        const now = new Date();
        await app.prisma.irrigationRun.create({
          data: {
            deviceId: device.id,
            startedAt: now,
            endedAt: new Date(now.getTime() + decision.runMs),
            runMs: decision.runMs,
            reason: decision.reason,
            soilMoisturePct: decision.soilMoisturePct,
          },
        });
      }
      return decision;
    },
  );

  // --- Sensor ingestion (device-authenticated) ----------------------------

  app.post(
    '/ingest',
    {
      schema: {
        tags: ['devices'],
        summary: 'Ingest a batch of buffered sensor readings (device token auth)',
        description:
          'Authenticated by the per-device token (Bearer <deviceId>.<secret>). ' +
          'Re-sending buffered readings is idempotent via the (device, metric, recordedAt) key.',
        security: [{ deviceAuth: [] }],
        body: IngestBody,
        response: {
          200: Type.Object({ accepted: Type.Integer() }),
          401: Type.Ref('Error'),
        },
      },
    },
    async (request, reply) => {
      const device = await deviceFromToken(request);
      if (!device) return reply.unauthorized('Invalid device token.');

      const { readings, batteryPct, firmwareVersion } = request.body;

      // Idempotent insert: skip duplicates by the unique (device, metric, time) key.
      const result = await app.prisma.sensorReading.createMany({
        data: readings.map((r) => ({
          deviceId: device.id,
          metric: r.metric,
          value: r.value,
          unit: r.unit,
          recordedAt: new Date(r.recordedAt),
        })),
        skipDuplicates: true,
      });

      await app.prisma.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          ...(batteryPct != null ? { batteryPct } : {}),
          ...(firmwareVersion ? { firmwareVersion } : {}),
        },
      });

      return { accepted: result.count };
    },
  );
};
