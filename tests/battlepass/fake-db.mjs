// A small in-memory stand-in for the MongoDB driver, covering what the Battle Pass API uses. It is only for tests.
import { ObjectId } from 'mongodb';

// structuredClone turns an ObjectId into a plain object, so documents are copied by hand.
function copy(v) {
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
  if (v instanceof ObjectId || v instanceof Date || typeof v !== 'object' || v === null) return v instanceof Date ? new Date(v) : v;
  if (Array.isArray(v)) return v.map(copy);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)]));
}

const norm = (v) => {
  if (v instanceof Date) return v.getTime();
  if (v instanceof ObjectId) return v.toHexString();
  if (typeof v === 'bigint' || typeof v === 'number') return String(v);
  return v;
};
const isOp = (o) => o && typeof o === 'object' && !Array.isArray(o) && !(o instanceof Date) && !(o instanceof ObjectId) && Object.keys(o).some((k) => k.startsWith('$'));
const get = (doc, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc);

function cmp(a, b) {
  const x = typeof a === 'string' && /^-?\d+$/.test(a) ? Number(a) : a;
  const y = typeof b === 'string' && /^-?\d+$/.test(b) ? Number(b) : b;
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchOne(value, cond) {
  if (!isOp(cond)) {
    if (Array.isArray(value)) return value.some((v) => norm(v) === norm(cond));
    return norm(value) === norm(cond);
  }
  return Object.entries(cond).every(([op, arg]) => {
    if (op === '$in') return arg.some((a) => (Array.isArray(value) ? value.some((v) => norm(v) === norm(a)) : norm(value) === norm(a)));
    if (op === '$ne') return Array.isArray(value) ? !value.some((v) => norm(v) === norm(arg)) : norm(value) !== norm(arg);
    if (op === '$exists') return (value !== undefined) === Boolean(arg);
    if (op === '$options') return true;
    if (op === '$regex') return typeof value === 'string' && new RegExp(arg, cond.$options || '').test(value);
    if (value === undefined || value === null) return false;
    if (op === '$lt') return cmp(norm(value), norm(arg)) < 0;
    if (op === '$lte') return cmp(norm(value), norm(arg)) <= 0;
    if (op === '$gt') return cmp(norm(value), norm(arg)) > 0;
    if (op === '$gte') return cmp(norm(value), norm(arg)) >= 0;
    throw new Error(`fake db: operator ${op} is not supported`);
  });
}

export function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, cond]) => {
    if (k === '$or') return cond.some((f) => matches(doc, f));
    return matchOne(get(doc, k), cond);
  });
}

function setPath(doc, path, value) {
  const keys = path.split('.');
  let o = doc;
  for (const k of keys.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
  o[keys.at(-1)] = value;
}

function applyUpdate(doc, update, inserting) {
  for (const [path, v] of Object.entries(update.$set || {})) setPath(doc, path, copy(v));
  for (const [path, v] of Object.entries(update.$inc || {})) setPath(doc, path, Number(get(doc, path) || 0) + Number(v));
  if (inserting) for (const [path, v] of Object.entries(update.$setOnInsert || {})) setPath(doc, path, copy(v));
  for (const [path, v] of Object.entries(update.$push || {})) {
    const arr = Array.isArray(get(doc, path)) ? get(doc, path) : [];
    const add = v && typeof v === 'object' && '$each' in v ? v.$each : [v];
    arr.push(...add.map(copy));
    setPath(doc, path, v && typeof v === 'object' && typeof v.$slice === 'number' && v.$slice < 0 ? arr.slice(v.$slice) : arr);
  }
  for (const [path, cond] of Object.entries(update.$pull || {})) {
    const arr = get(doc, path);
    if (Array.isArray(arr)) setPath(doc, path, arr.filter((x) => !(typeof cond === 'object' && cond !== null && !Array.isArray(cond) ? matches(x, cond) : norm(x) === norm(cond))));
  }
}

class Collection {
  constructor(name) { this.name = name; this.docs = []; }
  clone(d) { return d ? copy(d) : d; }
  async insertOne(doc) {
    const d = copy(doc);
    if (d._id === undefined) d._id = new ObjectId();
    if (this.docs.some((x) => norm(x._id) === norm(d._id))) { const e = new Error('E11000 duplicate key'); e.code = 11000; throw e; }
    this.docs.push(d);
    return { insertedId: d._id };
  }
  async findOne(filter) { return this.clone(this.docs.find((d) => matches(d, filter))) ?? null; }
  find(filter) {
    let rows = this.docs.filter((d) => matches(d, filter));
    const cursor = {
      sort: (spec) => {
        const keys = Object.entries(spec);
        rows = [...rows].sort((a, b) => { for (const [k, dir] of keys) { const c = cmp(norm(get(a, k)), norm(get(b, k))); if (c) return dir * c; } return 0; });
        return cursor;
      },
      skip: (n) => { rows = rows.slice(n); return cursor; },
      limit: (n) => { rows = rows.slice(0, n); return cursor; },
      project: () => cursor,
      toArray: async () => rows.map((d) => copy(d)),
    };
    return cursor;
  }
  aggregate(pipeline) {
    let rows = this.docs.map((d) => copy(d));
    for (const stage of pipeline) {
      if (stage.$match) rows = rows.filter((d) => matches(d, stage.$match));
      else if (stage.$group) {
        const { _id, ...acc } = stage.$group;
        const groups = new Map();
        for (const d of rows) {
          const key = typeof _id === 'string' && _id.startsWith('$') ? get(d, _id.slice(1)) : null;
          const g = groups.get(key) || { _id: key };
          for (const [name, spec] of Object.entries(acc)) {
            const [op, ref] = Object.entries(spec)[0];
            const v = Number(get(d, String(ref).slice(1)) || 0);
            if (op === '$sum') g[name] = (g[name] || 0) + (typeof ref === 'number' ? ref : v);
            if (op === '$max') g[name] = Math.max(g[name] ?? -Infinity, v);
          }
          groups.set(key, g);
        }
        rows = [...groups.values()];
      } else if (stage.$sort) {
        const keys = Object.entries(stage.$sort);
        rows.sort((a, b) => { for (const [k, dir] of keys) { const c = cmp(norm(get(a, k)), norm(get(b, k))); if (c) return dir * c; } return 0; });
      } else throw new Error('fake db: aggregate stage is not supported');
    }
    return { toArray: async () => rows };
  }
  async countDocuments(filter) { return this.docs.filter((d) => matches(d, filter)).length; }
  async updateOne(filter, update, opts = {}) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (doc) { applyUpdate(doc, update, false); return { matchedCount: 1, modifiedCount: 1 }; }
    if (!opts.upsert) return { matchedCount: 0, modifiedCount: 0 };
    const fresh = {};
    for (const [k, v] of Object.entries(filter)) if (!k.startsWith('$') && !isOp(v)) setPath(fresh, k, v);
    if (fresh._id === undefined) fresh._id = new ObjectId();
    if (this.docs.some((x) => norm(x._id) === norm(fresh._id))) { const e = new Error('E11000 duplicate key'); e.code = 11000; throw e; }
    applyUpdate(fresh, update, true);
    this.docs.push(fresh);
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
  }
  async findOneAndUpdate(filter, update, opts = {}) {
    await this.updateOne(filter, update, opts);
    return this.findOne(filter);
  }
  async deleteMany(filter) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matches(d, filter));
    return { deletedCount: before - this.docs.length };
  }
  async createIndex() { return 'ok'; }
  async deleteOne(filter) {
    const i = this.docs.findIndex((d) => matches(d, filter));
    if (i >= 0) this.docs.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  }
}

export function makeDb() {
  const cols = new Map();
  return { collection(name) { if (!cols.has(name)) cols.set(name, new Collection(name)); return cols.get(name); } };
}
