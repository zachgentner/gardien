/** Reusable TypeBox schemas + helpers shared across route modules. */
import { Type, type Static } from '@sinclair/typebox';

/**
 * A date-time field. Statically typed as `Date | string` so handlers can return
 * Prisma `Date` values directly, while the JSON schema marks it `date-time`
 * (fast-json-stringify serialises Date instances to ISO strings on the way out).
 */
export const DateTime = Type.Unsafe<Date | string>({ type: 'string', format: 'date-time' });
export const NullableDateTime = Type.Unsafe<Date | string | null>({
  anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
});

export const ErrorSchema = Type.Object(
  {
    statusCode: Type.Integer(),
    error: Type.String(),
    message: Type.String(),
  },
  { $id: 'Error', description: 'Standard error envelope.' },
);

export const IdParam = Type.Object({
  id: Type.String({ minLength: 1 }),
});
export type IdParam = Static<typeof IdParam>;

/** Common list query: pagination + include-archived toggle. */
export const ListQuery = Type.Object({
  includeArchived: Type.Optional(Type.Boolean({ default: false })),
  take: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  skip: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});
export type ListQuery = Static<typeof ListQuery>;

export const Timestamps = {
  createdAt: DateTime,
  updatedAt: DateTime,
  deletedAt: NullableDateTime,
};

/** Responses shared by every protected route. */
export const errorResponses = {
  400: Type.Ref(ErrorSchema),
  401: Type.Ref(ErrorSchema),
  404: Type.Ref(ErrorSchema),
};
