'use strict';

/* eslint-disable @typescript-eslint/no-explicit-any -- the mongodb-driver adapter is an
   open-shape boundary (arbitrary user docs/queries/options + foreign ObjectId-likes);
   `any` is honest here per the CLAUDE.md typing policy, not laziness. */

/**
 * ObjectId for the `micromongo/mock` driver adapter.
 *
 * Priority: if the CONSUMER has the real `bson` package installed (very common when a
 * project already depends on `mongodb`), we re-export THAT ObjectId — so ids created here
 * are `instanceof` the same class the code-under-test compares against, and `.equals()`
 * interop is exact. If `bson` isn't resolvable, we fall back to a self-contained 12-byte
 * implementation faithful enough for tests: 4-byte timestamp + 5 random + 3-byte counter,
 * 24-char lowercase hex, with `.toHexString()`/`.equals()`/`.toString()` and static
 * `isValid`/`createFromHexString`.
 *
 * Kept dependency-free at build time (the `require('bson')` is guarded and lazy), so the
 * adapter never *forces* `bson` on a consumer — it only borrows it when present.
 */

// Try the consumer's real bson first (optional; absence is normal).
var realObjectId: any = null;
try {
  // eslint-disable-next-line global-require
  realObjectId = require('bson').ObjectId;
} catch (e) {
  realObjectId = null;
}

// Lazy crypto (Node only). In a browser build this module isn't used, but keep the
// require guarded so merely loading the file never throws.
var randomBytes: ((n: number) => Buffer) | null = null;
try {
  // eslint-disable-next-line global-require
  randomBytes = require('crypto').randomBytes;
} catch (e) {
  randomBytes = null;
}

var HEX24 = /^[0-9a-fA-F]{24}$/;

// Process-wide 3-byte counter (matches the driver's monotonic-per-process counter).
var counter = randomBytes ? (randomBytes(3).readUIntBE(0, 3) & 0xffffff) : 0;

function nextCounter(): number {
  counter = (counter + 1) % 0x1000000;
  return counter;
}

function hex(n: number, width: number): string {
  var s = n.toString(16);
  while (s.length < width) { s = '0' + s; }
  return s.slice(-width);
}

/**
 * Fallback ObjectId (used only when `bson` is not installed in the consumer).
 */
class FallbackObjectId {
  private _hex: string;

  constructor(id?: string | FallbackObjectId | Buffer) {
    if (id == null) {
      this._hex = FallbackObjectId.generateHex();
    } else if (typeof id === 'string') {
      if (!HEX24.test(id)) {
        throw new TypeError('Argument passed in must be a string of 24 hex characters');
      }
      this._hex = id.toLowerCase();
    } else if (id instanceof FallbackObjectId) {
      this._hex = id._hex;
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(id)) {
      this._hex = id.toString('hex').slice(0, 24);
    } else if (typeof (id as any).toHexString === 'function') {
      // a foreign ObjectId-like (e.g. real bson) — accept its hex
      this._hex = (id as any).toHexString().toLowerCase();
    } else {
      throw new TypeError('Invalid ObjectId argument');
    }
  }

  static generateHex(): string {
    var ts = Math.floor(Date.now() / 1000) & 0xffffffff;
    var rand = randomBytes ? randomBytes(5).toString('hex') : hex(Math.floor(Math.random() * 0xffffffffff), 10);
    return hex(ts, 8) + rand + hex(nextCounter(), 6);
  }

  toHexString(): string { return this._hex; }
  toString(): string { return this._hex; }
  toJSON(): string { return this._hex; }

  equals(other: any): boolean {
    if (other == null) { return false; }
    if (typeof other === 'string') { return HEX24.test(other) && other.toLowerCase() === this._hex; }
    if (typeof other.toHexString === 'function') { return other.toHexString().toLowerCase() === this._hex; }
    return false;
  }

  // The 4-byte timestamp as a Date, like the real driver.
  getTimestamp(): Date {
    return new Date(parseInt(this._hex.slice(0, 8), 16) * 1000);
  }

  static isValid(id: any): boolean {
    if (id == null) { return false; }
    if (id instanceof FallbackObjectId) { return true; }
    if (typeof id === 'string') { return HEX24.test(id); }
    if (typeof id.toHexString === 'function') { return HEX24.test(id.toHexString()); }
    return false;
  }

  static createFromHexString(hexStr: string): FallbackObjectId {
    return new FallbackObjectId(hexStr);
  }
}

// Tag so instanceof-style checks and mongosh-ish inspection read naturally.
(FallbackObjectId.prototype as any)._bsontype = 'ObjectId';

// Export the real one if available, else the fallback. Consumers get a single `ObjectId`.
var ObjectId: any = realObjectId || FallbackObjectId;

export = ObjectId;
