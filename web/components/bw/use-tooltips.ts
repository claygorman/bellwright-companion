'use client';
// Global delegated tooltip for [data-tip] elements — ported from the prototype.
import { useEffect, type RefObject } from 'react';

export const useTooltips = (rootRef: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const tip = document.createElement('div');
    tip.setAttribute('role', 'tooltip');
    tip.style.cssText =
      "position:fixed;z-index:9999;pointer-events:none;opacity:0;transform:translateY(3px) scale(.96);transform-origin:center bottom;transition:opacity .12s ease,transform .12s ease;background:#201B14;color:#EDE4D2;border:1px solid #39311F;border-radius:6px;padding:6px 9px;font:500 12px/1.35 'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.55);max-width:250px;white-space:normal;";
    document.body.appendChild(tip);
    const show = (el: Element) => {
      const t = el.getAttribute('data-tip');
      if (!t) return;
      tip.textContent = t;
      tip.style.left = '-9999px'; tip.style.top = '0px';
      tip.style.opacity = '1'; tip.style.transform = 'translateY(0) scale(1)';
      const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
      let left = r.left + r.width / 2 - tr.width / 2;
      left = Math.max(6, Math.min(left, window.innerWidth - tr.width - 6));
      let top = r.top - tr.height - 8;
      if (top < 6) top = r.bottom + 8;
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
    };
    const hide = () => { tip.style.opacity = '0'; tip.style.transform = 'translateY(3px) scale(.96)'; };
    const over = (e: Event) => {
      const el = (e.target as Element).closest?.('[data-tip]');
      if (el) show(el);
    };
    const out = (e: Event) => {
      const el = (e.target as Element).closest?.('[data-tip]');
      if (el) {
        const to = (e as MouseEvent).relatedTarget as Node | null;
        if (!to || !el.contains(to)) hide();
      }
    };
    root.addEventListener('mouseover', over);
    root.addEventListener('mouseout', out);
    root.addEventListener('focusin', over);
    root.addEventListener('focusout', out);
    root.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', over);
      root.removeEventListener('focusout', out);
      root.removeEventListener('mousedown', hide, true);
      window.removeEventListener('scroll', hide, true);
      tip.remove();
    };
  }, [rootRef]);
};
