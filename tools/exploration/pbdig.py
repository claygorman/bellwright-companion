import struct
data = open('payload.bin','rb').read()
def rv(d,i):
    r=0;s=0
    while True:
        b=d[i];i+=1;r|=(b&0x7f)<<s
        if not b&0x80: return r,i
        s+=7
def fields_of(d,start,end):
    i=start;out=[]
    while i<end:
        try: tag,j=rv(d,i)
        except: return None
        f,w=tag>>3,tag&7
        if f==0 or f>100000: return None
        if w==0: v,j=rv(d,j);out.append((f,'v',v))
        elif w==1: v=struct.unpack_from('<d',d,j)[0];j+=8;out.append((f,'d',v))
        elif w==5: v=struct.unpack_from('<f',d,j)[0];j+=4;out.append((f,'f',v))
        elif w==2:
            ln,j=rv(d,j)
            if j+ln>end: return None
            out.append((f,'len',(j,ln)));j+=ln
        else: return None
        i=j
    return out

def get(d,start,end,fnum,idx=0):
    fs=fields_of(d,start,end); n=0
    for f,k,v in fs or []:
        if f==fnum:
            if n==idx: return k,v
            n+=1
    return None,None

top=fields_of(data,0,len(data))
# navigate to f21.f2
_,(o21,l21)=get(data,0,len(data),21)
_,(o212,l212)=get(data,o21,o21+l21,2)
groups={}
for f,k,v in fields_of(data,o212,o212+l212):
    groups.setdefault(f,[]).append(v)

import re
def show_record(off,ln,label,maxdepth=2):
    print(f"--- {label} ({ln}B) ---")
    def rec(o,l,depth):
        fs=fields_of(data,o,o+l)
        if fs is None:
            b=data[o:o+min(l,60)]
            if all(32<=c<127 for c in b) and l>0: print('  '*depth+f"raw str '{b.decode()}'")
            return
        for f,k,v in fs[:18]:
            if k=='len':
                oo,ll=v; b=data[oo:oo+min(ll,50)]
                if ll>0 and all(32<=c<127 for c in b):
                    print('  '*depth+f"f{f}: '{data[oo:oo+ll][:60].decode(errors='replace')}'"+(f"...({ll}B)" if ll>60 else ''))
                else:
                    print('  '*depth+f"f{f}: <{ll}B>")
                    if depth<maxdepth and ll>4: rec(oo,ll,depth+1)
            else:
                print('  '*depth+f"f{f}={v if k!='f' else round(v,2)}")
        if len(fs)>18: print('  '*depth+f"... {len(fs)-18} more fields")
for gf,items in sorted(groups.items()):
    print(f"\n########## f21.f2.f{gf}: {len(items)} records ##########")
    for i in [0,1]:
        off,ln=items[i]
        show_record(off,ln,f"record {i}")
