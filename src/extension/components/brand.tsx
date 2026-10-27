import { cn } from '@/lib/utils';
import appIcon from '@/extension/assets/brand/tuhamho-brow-icon.png';
import catArt from '@/extension/assets/brand/tuhamho-brow-cat.webp';

/** The supplied Tuhamho Brow cat artwork, used consistently in the app and extension. */
export function Logo({ className }: { className?: string; drawn?: boolean }) {
  return (
    <img src={appIcon} className={cn('size-7 rounded-[22%] object-cover', className)} alt="" aria-hidden="true" />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <Logo className="size-6 shrink-0 text-brand" />
      <span className="truncate font-display text-[0.9375rem] leading-none font-semibold tracking-tight text-ink max-[19rem]:hidden">
        Tuhamho Brow
      </span>
    </span>
  );
}

/** The full mascot illustration for welcome and start-page hero sections. */
export function CatMascot({ className }: { className?: string }) {
  return <img src={catArt} className={cn('object-cover', className)} alt="Tuhamho Brow orange cat mascot" />;
}
