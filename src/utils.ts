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

/**
 * Browser-safe `value instanceof Buffer`. `Buffer` is a Node global that does not
 * exist in browsers, so a bare `x instanceof Buffer` throws `ReferenceError` there.
 * Guarding on `typeof Buffer` keeps the Node behavior (a real Buffer is detected) and
 * is simply always `false` in runtimes without `Buffer` — which is correct, since such
 * runtimes have no Buffer values to detect.
 */
export function isBuffer(value: any): boolean {
  return typeof Buffer !== 'undefined' && value instanceof Buffer;
}
