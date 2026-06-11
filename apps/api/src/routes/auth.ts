import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import bcrypt from 'bcryptjs';

const Credentials = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8, maxLength: 200 }),
});

const RegisterBody = Type.Intersect([
  Credentials,
  Type.Object({ displayName: Type.Optional(Type.String({ maxLength: 120 })) }),
]);

const UserPublic = Type.Object({
  id: Type.String(),
  email: Type.String(),
  displayName: Type.Union([Type.String(), Type.Null()]),
  role: Type.String(),
  unitSystem: Type.String(),
});

const AuthResponse = Type.Object({
  token: Type.String(),
  user: UserPublic,
});

const BCRYPT_ROUNDS = 10;

export const authRoutes: FastifyPluginAsyncTypebox = async (app) => {
  // Tighter limits on credential endpoints to blunt brute-force / abuse.
  const authRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

  app.post(
    '/register',
    {
      config: authRateLimit,
      schema: {
        tags: ['auth'],
        summary: 'Register an account',
        description:
          'Single-user today: the first registration becomes the owner. Structured so additional users can be enabled later.',
        body: RegisterBody,
        response: {
          201: AuthResponse,
          409: Type.Ref('Error'),
        },
      },
    },
    async (request, reply) => {
      const { email, password, displayName } = request.body;
      const existing = await app.prisma.user.findUnique({ where: { email } });
      if (existing) return reply.conflict('An account with that email already exists.');

      // First user is the owner; later users are members.
      const userCount = await app.prisma.user.count();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await app.prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: displayName ?? null,
          role: userCount === 0 ? 'owner' : 'member',
        },
      });

      const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });
      return reply.code(201).send({ token, user: toPublic(user) });
    },
  );

  app.post(
    '/login',
    {
      config: authRateLimit,
      schema: {
        tags: ['auth'],
        summary: 'Log in and receive a JWT',
        body: Credentials,
        response: { 200: AuthResponse, 401: Type.Ref('Error') },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await app.prisma.user.findFirst({ where: { email, deletedAt: null } });
      if (!user) return reply.unauthorized('Invalid email or password.');

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return reply.unauthorized('Invalid email or password.');

      const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });
      return reply.send({ token, user: toPublic(user) });
    },
  );

  app.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Current authenticated user',
        security: [{ bearerAuth: [] }],
        response: { 200: UserPublic, 401: Type.Ref('Error') },
      },
    },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
      if (!user) return reply.unauthorized('Account no longer exists.');
      return toPublic(user);
    },
  );
};

function toPublic(user: {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  unitSystem: string;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    unitSystem: user.unitSystem,
  };
}
