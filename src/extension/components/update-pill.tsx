import { RefreshCw, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const PART = 'flex h-full cursor-pointer items-center outline-none transition-colors hover:bg-brand/15 focus-visible:bg-brand/15';

export const UPDATE_RESTARTS = 'Restarts the extension on the new version. This panel closes; open it again to carry on.';

export function UpdatePill({ version, onUpdate, onLater }: { version: string; onUpdate: () => void; onLater: () => void }) {
  return (
    <div className="enters mb-2 flex h-8 items-center overflow-hidden rounded-full border border-brand/45 bg-brand/10">
      <p className="flex min-w-0 flex-1 items-center gap-2 pl-3 text-xs text-ink">
        <RefreshCw className="size-3.5 shrink-0 text-brand" />
        <span className="truncate">Tuhamho Brow v{version} is ready</span>
      </p>
      <button
        type="button"
        onClick={onUpdate}
        title={UPDATE_RESTARTS}
        className={cn(PART, 'px-3 text-xs font-medium whitespace-nowrap text-brand')}
      >
        Update
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-brand/30" />
      <button
        type="button"
        onClick={onLater}
        title="Later"
        aria-label="Later: hide the update notice"
        className={cn(PART, 'pr-3 pl-2 text-ink-dim hover:text-ink focus-visible:text-ink')}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
