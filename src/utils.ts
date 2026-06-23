/**
 * Created by alykoshin on 16.04.16.
 *
 * Mongo-shape compatibility stub. micromongo has no BSON layer, so ObjectId is an
 * identity function — it returns whatever it is given — letting documents that carry
 * an `ObjectId(...)`-wrapped id round-trip unchanged. Kept as a named export so
 * `require('./utils').ObjectId` resolves exactly as before the TS migration; under
 * `module:commonjs` this emits `exports.ObjectId = ...`.
 */

'use strict';

export function ObjectId<T>(id: T): T {
  return id;
}
