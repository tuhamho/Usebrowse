import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { browser } from 'wxt/browser';
import { ANDROID_PROTOCOL, failure, type ActionResult } from '@/lib/actions/protocol';
import { isLive } from '@/lib/bridge/phone';
import { askPhone, usePhoneSession } from '@/lib/bridge/phone-client';
import type { DaemonState } from '@/lib/bridge/socket';
import { useDaemonState } from '@/lib/bridge/use-daemon-state';
import type { AndroidState } from '@/lib/phone/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

const ERROR_SHOWN_MS = 6_000;

/** The first phone adb has a connection to; Chrome closed on it is handled once the session starts. */
export const drivablePhone = (android: AndroidState | undefined) => android?.devices.find((device) => device.state === 'ready');

function whyNoPhone(daemon: DaemonState | null, android: AndroidState | undefined): string {
  if (import.meta.env.FIREFOX) return 'Android phones are driven from Chrome and other Chromium browsers, not Firefox.';
  if (!daemon?.connected) return 'Connect to Tuhamho Brow Bridge first, then switch to the phone.';
  if (!android) return 'This Tuhamho Brow Bridge is too old to drive a phone. Update it, then try again.';
  return android.devices[0]?.problem?.message ?? android.problem?.message ?? 'The phone is not ready.';
}

export interface PhoneSwitch {
  on: boolean;
  ready: boolean;
  /** What stands between the user and a ready phone; empty once there is none. */
  problem: string;
  toggle: () => Promise<ActionResult<unknown>>;
}

export function usePhoneSwitch(): PhoneSwitch {
  const daemon = useDaemonState();
  const session = usePhoneSession();
  const android =
    !import.meta.env.FIREFOX && daemon?.connected && (daemon.protocolVersion ?? 0) >= ANDROID_PROTOCOL ? daemon.android : undefined;
  const on = isLive(session);
  const phone = drivablePhone(android);
  const ready = on || phone !== undefined;
  const problem = ready ? '' : whyNoPhone(daemon, android);

  const toggle = async (): Promise<ActionResult<unknown>> => {
    if (on) return askPhone({ op: 'phoneEnd' });
    if (!phone) return failure('PHONE_NOT_READY', problem);
    return askPhone({ op: 'phoneStart', serial: phone.serial, windowId: (await browser.windows.getCurrent()).id });
  };

  return { on, ready, problem, toggle };
}

export function PhoneToggle() {
  const phone = usePhoneSwitch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(undefined), ERROR_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [error]);

  if (import.meta.env.FIREFOX) return null;

  const toggle = async () => {
    setBusy(true);
    setError(undefined);
    const result = await phone.toggle();
    setBusy(false);
    if (!result.ok) setError(result.error.message);
  };

  return (
    <span className="relative">
      <Button
        variant={phone.on ? 'subtle' : 'ghost'}
        size="icon-sm"
        title={phone.ready ? 'Drive Chrome on your Android phone' : phone.problem}
        aria-label="Android"
        aria-pressed={phone.on}
        disabled={busy || !phone.ready}
        onClick={() => void toggle()}
      >
        <Smartphone className={cn('size-3.5', busy && 'animate-pulse')} />
      </Button>
      {error && (
        <span
          role="status"
          className="absolute top-full right-0 z-20 mt-1.5 w-56 rounded-lg border border-destructive/40 bg-surface px-2.5 py-1.5 text-[11.5px] text-ink shadow-lg"
        >
          {error}
        </span>
      )}
    </span>
  );
}
