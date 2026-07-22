#!/usr/bin/env python3
"""Extract all TownNpc names + 14 skill stats (level/xp/cap) from a decompressed
Bellwright payload (tools/dump output). Exploration-grade; the production Node
parser will supersede this. Usage: extract_npcs.py payload.bin [--json]"""
import re, struct, sys, json

SKILLS = ['strength','agility','one_handed','two_handed','polearm','block','archery',
          'harvest','farm','animal','cook','craft','research','labour']  # skill ids 1..14

def rv(d, i):
    r = 0; s = 0
    while True:
        b = d[i]; i += 1; r |= (b & 0x7f) << s
        if not b & 0x80: return r, i
        s += 7

def fields_of(d, start, end):
    i = start; out = []
    while i < end:
        try: tag, j = rv(d, i)
        except Exception: return None
        f, w = tag >> 3, tag & 7
        if f == 0 or f > 100000: return None
        if w == 0: v, j = rv(d, j); out.append((f, 'v', v))
        elif w == 1: v = struct.unpack_from('<d', d, j)[0]; j += 8; out.append((f, 'd', v))
        elif w == 5: v = struct.unpack_from('<f', d, j)[0]; j += 4; out.append((f, 'f', v))
        elif w == 2:
            ln, j = rv(d, j)
            if j + ln > end: return None
            out.append((f, 'len', (j, ln))); j += ln
        else: return None
        i = j
    return out

def main(path, as_json=False):
    data = open(path, 'rb').read()
    top = fields_of(data, 0, len(data))
    # f8 = entity name table (ids elsewhere are indexes into it)
    names = []
    for f, k, v in top:
        if f == 8 and k == 'len':
            o, l = v
            names.append(data[o:o+l].decode(errors='replace') if l else '')
    # GUID -> display-name pool (UE-serialized string pairs)
    guid_name = {}
    pat = re.compile(rb'(?:\x21\x00\x00\x00)([0-9A-F]{32})\x00(....)', re.DOTALL)  # DOTALL: length bytes can be \n etc.
    i = 0
    while True:
        m = pat.search(data, i)
        if not m: break
        g = m.group(1).decode(); ln = int.from_bytes(m.group(2), 'little')
        s = data[m.end():m.end()+ln]
        if 0 < ln < 40 and s.endswith(b'\x00') and all(32 <= c < 127 for c in s[:-1]):
            guid_name.setdefault(g, s[:-1].decode())
        i = m.start() + 1
    # world blob: f21.f2.f1 = placed actors
    _, (o21, l21) = [(f, v) for f, k, v in top if f == 21 and k == 'len'][0]
    _, (o212, l212) = [(f, v) for f, k, v in fields_of(data, o21, o21+l21) if f == 2 and k == 'len'][0]
    actors = [v for f, k, v in fields_of(data, o212, o212+l212) if f == 1 and k == 'len']

    npcs = []
    for off, ln in actors:
        fs = fields_of(data, off, off+ln)
        comps = {}; cls = None; pos = None; guid = None
        for f, k, v in fs:
            if f == 1 and k == 'len': guid = data[v[0]:v[0]+v[1]].decode(errors='replace')
            if f == 2 and k == 'len':
                for f2, k2, v2 in fields_of(data, v[0], v[0]+v[1]):
                    if f2 == 4 and k2 == 'v' and v2 < len(names):
                        cls = names[v2].split('.')[-1]
                    if f2 == 5 and k2 == 'len':
                        for tf, tk, tv in fields_of(data, v2[0], v2[0]+v2[1]) or []:
                            if tf == 2 and tk == 'len':
                                p = [pv for pf, pk, pv in fields_of(data, tv[0], tv[0]+tv[1]) or [] if pk == 'f']
                                if len(p) >= 3: pos = p[:3]
                    if f2 == 2 and k2 == 'len':
                        c = fields_of(data, v2[0], v2[0]+v2[1]); cid = None; dd = None
                        for f3, k3, v3 in c or []:
                            if f3 == 1 and k3 == 'v': cid = v3
                            if f3 == 2 and k3 == 'len': dd = v3
                        if cid is not None and cid < len(names):
                            comps[names[cid].split('.')[-1]] = dd
        if not (cls and cls.startswith('TownNpc_C')) or 'MistHuman' not in comps: continue
        hoff, hlen = comps['MistHuman']
        skills = {}
        for f, k, v in fields_of(data, hoff, hoff+hlen):
            if f == 2 and k == 'len':
                for f2, k2, v2 in fields_of(data, v[0], v[0]+v[1]):
                    if f2 == 2 and k2 == 'len':
                        rec = {}
                        for f3, k3, v3 in fields_of(data, v2[0], v2[0]+v2[1]) or []:
                            if k3 == 'v': rec[f3] = v3
                        sid = rec.get(1)
                        if sid and 1 <= sid <= 14:
                            skills[SKILLS[sid-1]] = {'level': rec.get(2, 0), 'xp': rec.get(3, 0), 'cap': rec.get(4, 0)}
        first = last = None
        if comps.get('MistTownNpc'):
            toff, tlen = comps['MistTownNpc']
            gn = [guid_name.get(g.decode()) for g in re.findall(rb'([0-9A-F]{32})\x00', data[toff:toff+tlen])]
            gn = [g for g in gn if g]
            if gn: first = gn[0]
            if len(gn) > 1: last = gn[1]
        npcs.append({'guid': guid, 'first_name': first, 'last_name': last,
                     'position': pos, 'skills': skills})
    if as_json:
        print(json.dumps(npcs, indent=1))
    else:
        print(f"{len(npcs)} TownNpcs")
        for n in npcs:
            if n['first_name']:
                nm = f"{n['first_name']} {n['last_name'] or ''}".strip()
                sk = n['skills']
                row = " ".join(f"{sk.get(s,{}).get('level',0)}/{sk.get(s,{}).get('cap',0)}" for s in SKILLS)
                print(f"{nm[:24]:24s} {row}")

if __name__ == '__main__':
    main(sys.argv[1], '--json' in sys.argv)
