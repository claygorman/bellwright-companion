// Bellwright decompressed-payload model (see ../../docs/save-format.md).
// Input: the raw protobuf blob produced by tools/dump (VSWB -> Oodle -> payload).
import { fieldsOf, first, all } from './wire.ts';
import type { Field, Region, Meta } from './types.ts';

export const SKILLS: string[] = [
  'strength', 'agility', 'one_handed', 'two_handed', 'polearm', 'block', 'archery',
  'harvest', 'farm', 'animal', 'cook', 'craft', 'research', 'labour',
]; // skill ids 1..14

// Equipment slot ids observed (Fabian ground truth, build 0.0.51351)
export const EQUIP_SLOTS: Record<number, string> = {
  1: 'weapon', 2: 'offhand', 3: 'head', 4: 'chest', 5: 'legs', 6: 'gloves',
  7: 'boots', 8: 'cloak', 9: 'backpack', 12: 'food_bag', 14: 'tool',
};

export class Payload {
  buf: Buffer;
  top: Field[];
  names: string[];
  guidNames: Map<string, string>;
  meta: Meta;
  actors: Region[];
  components: Region[];

  constructor(buf: Buffer) {
    this.buf = buf;
    const top = fieldsOf(buf, 0, buf.length);
    if (!top) throw new Error('payload does not parse as protobuf');
    this.top = top;

    // f8: entity name table — numeric ids elsewhere are indexes into it
    this.names = all(this.top, 8, 'len').map(({ v }) =>
      v.len ? buf.toString('latin1', v.off, v.off + v.len) : '');

    // GUID -> display-name pool (UE-serialized string pairs). The 4 length
    // bytes can be ANY value (0x0A included) — hence lastIndex-based scanning.
    this.guidNames = new Map();
    const pat = /\x21\x00\x00\x00([0-9A-F]{32})\x00/gs;
    const hay = buf.toString('latin1');
    let m;
    while ((m = pat.exec(hay)) !== null) {
      const at = m.index + m[0].length;
      const len = buf.readUInt32LE(at);
      if (len > 0 && len < 40 && at + 4 + len <= buf.length) {
        const s = buf.toString('latin1', at + 4, at + 4 + len);
        if (s.endsWith('\0') && /^[\x20-\x7e]+$/.test(s.slice(0, -1))) {
          if (!this.guidNames.has(m[1])) this.guidNames.set(m[1], s.slice(0, -1));
        }
      }
    }

    // game/build metadata
    this.meta = {
      character: this.#str(1), map: this.#str(2), saveName: this.#str(9),
      region: this.#str(10), createdBuild: this.#str(14), savedBuild: this.#str(15),
      playtimeSeconds: first(this.top, 6, 'd')?.v ?? null,
    };

    // world blob f21.f2: f1 placed actors, f2 components, f3 data bags
    const f21f = first(this.top, 21, 'len');
    if (!f21f) throw new Error('payload missing world blob (f21)');
    const f21 = f21f.v;
    const w = fieldsOf(buf, f21.off, f21.off + f21.len);
    const f212f = first(w, 2, 'len');
    if (!f212f) throw new Error('world blob missing f2');
    const f212 = f212f.v;
    const g = fieldsOf(buf, f212.off, f212.off + f212.len);
    this.actors = all(g, 1, 'len').map(x => x.v);
    this.components = all(g, 2, 'len').map(x => x.v);
  }

  #str(f: number): string | null {
    const x = first(this.top, f, 'len');
    return x ? this.buf.toString('utf8', x.v.off, x.v.off + x.v.len) : null;
  }

  /** Resolve a name-table id to its short class/base name. */
  baseName(id: number): string | null {
    const n = this.names[id];
    if (n == null) return null;
    const tail = (n.includes('/') ? n.split('/').pop() : n) ?? n;
    return (tail.split('.').pop() ?? tail).split('_UAID')[0];
  }

  fields(region?: Region | null): Field[] | null { return region ? fieldsOf(this.buf, region.off, region.off + region.len) : null; }
  string(region: Region): string { return this.buf.toString('latin1', region.off, region.off + region.len); }
}
