'use client';
// Upload-a-save modal (Claude Design handoff): drag/drop or browse a .sav,
// POST it to /api/ingest, refresh the world on success. Lets people try the
// app without setting up the publisher.
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const SAVE_RE = /\.(sav|savegame|dat)$/i;
const fmtSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const UpArrow = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </svg>
);

export const UploadButton = ({ onIngested }: { onIngested: () => void }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    if (!SAVE_RE.test(f.name)) {
      setError('That doesn’t look like a Bellwright save (.sav).'); setFile(null); return;
    }
    setFile(f); setError('');
  };

  const close = () => { if (!ingesting) { setOpen(false); setFile(null); setError(''); } };

  const ingest = async () => {
    if (!file || ingesting) return;
    setIngesting(true); setError('');
    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: await file.arrayBuffer() });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `ingest failed (${res.status})`);
      setOpen(false); setFile(null);
      onIngested();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIngesting(false);
    }
  };

  return (
    <>
      <button onClick={() => { setOpen(true); setFile(null); setError(''); }}
        data-tip="Upload a Bellwright save file"
        className="flex items-center gap-2 h-[34px] px-3 rounded-lg border border-gold/50 bg-gold/[.12] text-gold-bright text-xs font-semibold cursor-pointer flex-none hover:bg-gold/[.2] hover:border-gold">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        <span>Upload save</span>
      </button>
      {open && (
        <div onClick={close}
          className="fixed inset-0 bg-[rgba(8,7,5,.65)] backdrop-blur-[2px] z-[80] flex items-center justify-center p-6 [animation:bwfade_.16s_ease]">
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-[440px] bg-iron-850 border border-line-4 rounded-[14px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,.6)]">
            <div className="flex items-center justify-between py-[15px] px-5 border-b border-[#2A231A] bg-[#1B1712]">
              <h3 className="font-serif text-[17px] font-semibold text-sand-50">Upload save file</h3>
              <button onClick={close}
                className="bg-none border border-[#342C22] text-sand-400 w-[30px] h-[30px] rounded-lg cursor-pointer text-base hover:border-[#4a4030] hover:text-[#EDA593]">×</button>
            </div>
            <div className="p-5">
              <label
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
                className={cn(
                  'flex flex-col items-center justify-center text-center py-8 px-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                  dragging ? 'border-gold bg-gold/[.08]' : 'border-line-4 bg-ink hover:border-[#4a4030]',
                )}>
                <input ref={inputRef} type="file" accept=".sav,.savegame,.dat" className="hidden"
                  onChange={e => pick(e.target.files?.[0])} />
                <span className="text-gold mb-2.5"><UpArrow size={30} /></span>
                {file ? (
                  <>
                    <div className="text-sand-100 font-semibold text-[13px]">{file.name}</div>
                    <div className="text-[11.5px] text-sand-400 mt-0.5">{fmtSize(file.size)} · ready to ingest</div>
                  </>
                ) : (
                  <>
                    <div className="text-sand-200 font-medium text-[13px]">
                      Drop your save here, or <span className="text-gold-bright underline">browse</span>
                    </div>
                    <div className="text-[11.5px] text-sand-500 mt-1">
                      Bellwright save files — usually named <span className="font-mono text-sand-400">Save.sav</span>
                    </div>
                  </>
                )}
              </label>
              <div className="flex items-center gap-2 mt-3 text-[11px] text-sand-600">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
                </svg>
                <span>Parsed locally on your server — nothing leaves your network.</span>
              </div>
              {error && (
                <div className="mt-3 text-[12px] text-rust-soft bg-rust/[.12] border border-rust/40 rounded-lg py-2 px-3">{error}</div>
              )}
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={close}
                  className="py-[9px] px-4 rounded-lg border border-line-3 bg-ink text-sand-400 text-[12.5px] font-medium cursor-pointer hover:border-[#4a4030]">Cancel</button>
                <button onClick={ingest} disabled={!file || ingesting}
                  className={cn(
                    'inline-flex items-center gap-2 py-[9px] px-4 rounded-lg border border-gold bg-gold text-[#1a150c] text-[12.5px] font-semibold font-sans',
                    file && !ingesting ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-50',
                  )}>
                  {ingesting && (
                    <span className="w-[13px] h-[13px] rounded-full border-2 border-[#1a150c]/40 border-t-[#1a150c] [animation:bwspin_.7s_linear_infinite]" />
                  )}
                  <span>{ingesting ? 'Ingesting…' : 'Ingest save'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
