'use client';
// shadcn-style dropdown menu on @base-ui/react Menu, themed with the
// Bellwright design tokens (popover look from the Claude Design handoff:
// dark #1B1712 panel, gold check indicator, soft fade).
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export const DropdownMenuContent = ({ className, align = 'end', sideOffset = 6, children, ...props }: React.ComponentProps<typeof Menu.Popup> & { align?: 'start' | 'center' | 'end'; sideOffset?: number }) => (
  <Menu.Portal>
    {/* collisionPadding keeps the panel off the viewport edges; the Popup caps
        its own width so long content wraps instead of overflowing off-screen */}
    <Menu.Positioner align={align} sideOffset={sideOffset} collisionPadding={8} className="z-[91] outline-none">
      <Menu.Popup
        className={cn(
          'min-w-46 max-w-[calc(100vw-16px)] rounded-md border border-line-4 bg-[#1B1712] p-1',
          'shadow-[0_16px_40px_rgba(0,0,0,.5)] [animation:bwfade_.1s_ease] outline-none',
          className,
        )}
        {...props}>
        {children}
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
);

export const DropdownMenuItem = ({ className, ...props }: React.ComponentProps<typeof Menu.Item>) => (
  <Menu.Item
    className={cn(
      'relative flex items-center w-full gap-2 rounded-sm py-1.5 pl-8 pr-3 text-[12.5px] md:text-[14px] text-sand-200',
      'cursor-pointer font-sans text-left outline-none select-none',
      'data-[highlighted]:bg-white/[.06]',
      className,
    )}
    {...props} />
);

export const DropdownMenuRadioItem = ({ className, children, ...props }: React.ComponentProps<typeof Menu.RadioItem>) => (
  <Menu.RadioItem
    className={cn(
      'relative flex items-center w-full gap-2 rounded-sm py-1.5 pl-8 pr-3 text-[12.5px] md:text-[14px] text-sand-200',
      'cursor-pointer font-sans text-left outline-none select-none',
      'data-[highlighted]:bg-white/[.06]',
      className,
    )}
    {...props}>
    <Menu.RadioItemIndicator className="absolute left-2.5 inline-flex">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F4C868"
        strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </Menu.RadioItemIndicator>
    {children}
  </Menu.RadioItem>
);

export const DropdownMenuLabel = ({ className, ...props }: React.ComponentProps<typeof Menu.GroupLabel>) => (
  <Menu.GroupLabel
    className={cn('py-1.5 pl-3 pr-3 text-[10px] md:text-[11px] tracking-[.5px] uppercase text-sand-600 font-sans', className)}
    {...props} />
);

export const DropdownMenuSeparator = ({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) => (
  <Menu.Separator className={cn('my-1 h-px bg-line-2', className)} {...props} />
);

export const ChevronDown = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8a8069"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// Select-style dropdown: labeled trigger showing the current value, menu of
// radio items — the design's "View: Skills ▾" pattern.
export const BwSelect = ({ label, value, options, onChange, triggerClassName, valueLabel, align = 'end' }: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  triggerClassName?: string;
  valueLabel?: string; // override the trigger's value text
  align?: 'start' | 'center' | 'end';
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      className={cn(
        'inline-flex items-center gap-2 h-8.5 pl-3 pr-2.5 bg-ink border border-line-3 rounded-lg',
        'cursor-pointer font-sans hover:border-[#4a4030] outline-none',
        triggerClassName,
      )}>
      {label && <span className="text-[10.5px] md:text-[11.5px] tracking-[.4px] uppercase text-sand-600">{label}</span>}
      <span className="text-[12.5px] md:text-[14px] text-sand-200 truncate">
        {valueLabel ?? options.find(o => o.value === value)?.label ?? value}
      </span>
      <span className="ml-auto inline-flex"><ChevronDown /></span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align={align}>
      <DropdownMenuRadioGroup value={value} onValueChange={v => onChange(v as string)}>
        {options.map(o => (
          <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);
