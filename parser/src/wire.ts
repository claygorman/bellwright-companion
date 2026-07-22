// Protobuf wire-format walking over a Buffer — no schema, heuristic descent.
import type { Field } from './types.ts';
export function readVarint(buf: Buffer, i: number): [number | bigint, number] {
  let r = 0n, s = 0n;
  for (;;) {
    const b = buf[i++];
    r |= BigInt(b & 0x7f) << s;
    if (!(b & 0x80)) {
      const n = r <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(r) : r;
      return [n, i];
    }
    s += 7n;
    if (s > 63n) throw new RangeError('varint too long');
  }
}

/** Parse [start,end) as a protobuf message. Returns array of {f, kind, v}
 *  (kind: 'v' varint | 'd' f64 | 'f' f32 | 'len' -> v={off,len}), or null if
 *  the region does not parse cleanly as a message. */
export function fieldsOf(buf: Buffer, start: number, end: number): Field[] | null {
  const out: Field[] = [];
  let i = start;
  while (i < end) {
    let tag: number | bigint;
    try { [tag, i] = readVarint(buf, i); } catch { return null; }
    if (typeof tag !== 'number') return null;
    const f = tag >>> 3, w = tag & 7;
    if (f === 0 || f > 100000) return null;
    if (w === 0) {
      let v: number | bigint; try { [v, i] = readVarint(buf, i); } catch { return null; }
      out.push({ f, kind: 'v', v });
    } else if (w === 1) {
      if (i + 8 > end) return null;
      out.push({ f, kind: 'd', v: buf.readDoubleLE(i) }); i += 8;
    } else if (w === 5) {
      if (i + 4 > end) return null;
      out.push({ f, kind: 'f', v: buf.readFloatLE(i) }); i += 4;
    } else if (w === 2) {
      let len: number | bigint; try { [len, i] = readVarint(buf, i); } catch { return null; }
      if (typeof len !== 'number' || i + len > end) return null;
      out.push({ f, kind: 'len', v: { off: i, len } }); i += len;
    } else return null;
  }
  return out;
}

export const first = (fields: Field[] | null | undefined, f: number, kind?: Field['kind']) => fields?.find(x => x.f === f && (!kind || x.kind === kind));
export const all = (fields: Field[] | null | undefined, f: number, kind?: Field['kind']): Field[] => fields?.filter(x => x.f === f && (!kind || x.kind === kind)) ?? [];
