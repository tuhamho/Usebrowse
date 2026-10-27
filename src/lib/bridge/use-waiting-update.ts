import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { WAITING_UPDATE_KEY, asWaitingVersion, lookForRebuild, restartIntoUpdate } from './extension-update';

export interface WaitingUpdateView {
  version: string | null;
  restart: () => void;
  later: () => void;
}

/** The update the browser holds for this extension. Later hides it until the panel opens again or a newer one arrives. */
export function useWaitingUpdate(): WaitingUpdateView {
  const [waiting, setWaiting] = useState<string | null>(null);
  const [deferred, setDeferred] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void browser.storage.session.get(WAITING_UPDATE_KEY).then((stored) => {
      if (live) setWaiting(asWaitingVersion(stored[WAITING_UPDATE_KEY]));
    });
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      if (WAITING_UPDATE_KEY in changes) setWaiting(asWaitingVersion(changes[WAITING_UPDATE_KEY].newValue));
    };
    browser.storage.session.onChanged.addListener(listener);
    const look = () => void lookForRebuild();
    look();
    window.addEventListener('focus', look);
    return () => {
      live = false;
      browser.storage.session.onChanged.removeListener(listener);
      window.removeEventListener('focus', look);
    };
  }, []);

  return {
    version: waiting !== deferred ? waiting : null,
    restart: restartIntoUpdate,
    later: () => setDeferred(waiting),
  };
}
