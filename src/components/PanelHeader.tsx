import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// The header strip on top of every panel: icon + title on the left, actions on the right.
export function PanelHeader({ icon, title, extra, actions, className }: { icon?: ReactNode; title: ReactNode; extra?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-11 flex-none items-center gap-2 border-b px-3', className)}>
      {icon && <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>}
      <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">{title}</span>
      {extra}
      <span className="flex-1" />
      {actions && <div className="flex items-center gap-0.5">{actions}</div>}
    </div>
  );
}

// A small ghost icon button with a tooltip.
export function IconButton({
  label,
  icon,
  onClick,
  side = 'bottom',
  disabled,
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label} className={cn('size-7 text-muted-foreground hover:text-foreground', className)}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
