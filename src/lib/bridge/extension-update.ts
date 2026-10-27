import { browser } from 'wxt/browser';
import { isNewer } from '@/lib/version';
import { onWelcome } from './socket';

export const WAITING_UPDATE_KEY = 'browsentic/waitingUpdate';

const CHECKED_FOR_KEY = 'browsentic/updateCheckedFor';

export const runningVersion = (): string => browser.runtime.getManifest().version;

/** The version a restart would run, as long as it is newer than the one running now. */
export const asWaitingVersion = (value: unknown, running = runningVersion()): string | null =>
  typeof value === 'string' && isNewer(value, running) ? value : null;

const hold = (version: string) => browser.storage.session.set({ [WAITING_UPDATE_KEY]: version });

/**
 * A browser installs a store update only once the extension goes idle, and a live Bridge link keeps it
 * from ever going idle, so a downloaded update is held for the panel to restart into. A Bridge newer
 * than this extension is the sign a release is out, so it asks the store now rather than on the
 * browser's own timer.
 */
export function serveExtensionUpdates(): void {
  browser.runtime.onUpdateAvailable.addListener(({ version }) => void hold(version));
  onWelcome((daemonVersion) => void followBridge(daemonVersion));
}

export async function followBridge(daemonVersion: string): Promise<void> {
  if (!isNewer(daemonVersion, runningVersion())) return;
  if (await isUnpacked()) return holdRebuild();
  if (import.meta.env.FIREFOX) return;
  // The browser grants one check every few hours, so each newer Bridge spends it once.
  const checked = await browser.storage.session.get(CHECKED_FOR_KEY);
  if (checked[CHECKED_FOR_KEY] === daemonVersion) return;
  await browser.storage.session.set({ [CHECKED_FOR_KEY]: daemonVersion });
  await browser.runtime.requestUpdateCheck().catch(() => undefined);
}

/** The Bridge restarts before it rewrites an unpacked folder, so its welcome can come too early to see the new build. */
export async function lookForRebuild(): Promise<void> {
  if (await isUnpacked()) await holdRebuild();
}

const isUnpacked = async () => (await browser.management.getSelf()).installType === 'development';

async function holdRebuild(): Promise<void> {
  const rebuilt = asWaitingVersion(await unpackedVersion());
  if (rebuilt) await hold(rebuilt);
}

/** An unpacked copy reads its files from the folder the Bridge rewrites, so the manifest there names the build a reload loads. */
async function unpackedVersion(): Promise<string | null> {
  try {
    const response = await fetch('/manifest.json', { cache: 'no-store' });
    const { version } = (await response.json()) as { version?: unknown };
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

export const restartIntoUpdate = (): void => browser.runtime.reload();
