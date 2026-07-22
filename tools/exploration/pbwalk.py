import sys, struct
data = open('payload.bin','rb').read()

def rv(d, i):  # read varint
    r = 0; s = 0
    while True:
        b = d[i]; i += 1
        r |= (b & 0x7f) << s
        if not b & 0x80: return r, i
        s += 7
        if s > 63: raise ValueError('varint too long')

def walk(d, start, end, depth, maxdepth, path=''):
    """Yield (path, field, wire, size, payload_start) for each field; recurse into len-delim that parse cleanly."""
    i = start
    fields = {}
    while i < end:
        try: tag, j = rv(d, i)
        except Exception: return None
        f, w = tag >> 3, tag & 7
        if f == 0 or f > 10000: return None
        if w == 0:
            v, j = rv(d, j)
            fields.setdefault((f,'varint'), []).append(v)
        elif w == 1:
            v = struct.unpack_from('<d', d, j)[0]; j += 8
            fields.setdefault((f,'f64'), []).append(v)
        elif w == 5:
            v = struct.unpack_from('<f', d, j)[0]; j += 4
            fields.setdefault((f,'f32'), []).append(v)
        elif w == 2:
            ln, j = rv(d, j)
            if j + ln > end: return None
            fields.setdefault((f,'len'), []).append((j, ln))
            j += ln
        else:
            return None
        i = j
    return fields

def describe(d, start, end, depth=0, maxdepth=3, prefix=''):
    fields = walk(d, start, end, depth, maxdepth)
    if fields is None:
        print(f"{'  '*depth}{prefix}<not a message / raw bytes {end-start}B>")
        return
    for (f, kind), vals in sorted(fields.items()):
        if kind == 'len':
            total = sum(l for _, l in vals)
            # try to show as string
            off, ln = vals[0]
            sample = d[off:off+min(ln, 40)]
            printable = all(32 <= c < 127 for c in sample) and ln > 0
            label = f"{'  '*depth}f{f} len x{len(vals)} total={total}B"
            if printable:
                print(f"{label}  str~'{sample.decode()}'")
            else:
                print(label)
                if depth < maxdepth and total > 100:
                    describe(d, off, off+ln, depth+1, maxdepth)
        else:
            preview = vals[:4]
            print(f"{'  '*depth}f{f} {kind} x{len(vals)}  e.g. {preview}")

print("=== TOP LEVEL ===")
describe(data, 0, len(data), 0, 2)
