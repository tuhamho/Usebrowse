import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { failure, success } from '@/lib/actions/protocol';
import type { PhoneClosedReason, PhoneOpened } from '@/lib/phone/types';

const socket = vi.hoisted(() => ({
  openPhone: vi.fn(),
  closePhone: vi.fn(),
  launchPhoneChrome: vi.fn(),
  daemonClosed: [] as (() => void)[],
  phoneClosed: [] as ((serial: string, reason: PhoneClosedReason) => void)[],
}));

vi.mock('./socket', () => ({
  DAEMON_STATE_KEY: 'browsentic/daemon',
  openPhone: socket.openPhone,
  closePhone: socket.closePhone,
  launchPhoneChrome: socket.launchPhoneChrome,
  onDaemonClosed: (listener: () => void) => socket.daemonClosed.push(listener),
  onPhoneClosed: (listener: (serial: string, reason: PhoneClosedReason) => void) => socket.phoneClosed.push(listener),
}));

const { endPhone, leftMirror, openChromeOnPhone, readPhone, servePhone, startPhone, updatePhone } = await import('./phone');

const SERIAL = 'emulator-5554';
const OPENED: PhoneOpened = {
  device: { serial: SERIAL, transport: 'usb', state: 'ready', model: 'Pixel 8', chrome: { installed: true, running: true, debuggable: true } },
  targets: [{ targetId: 'A'.repeat(32), url: 'https://example.com/', title: 'Example' }],
  browserVersion: 'Chrome/150.0.7871.186',
};

let notify: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  fakeBrowser.reset();
  socket.daemonClosed.length = 0;
  socket.phoneClosed.length = 0;
  socket.openPhone.mockReset().mockResolvedValue(success(OPENED));
  socket.closePhone.mockReset();
  socket.launchPhoneChrome.mockReset().mockResolvedValue(success({}));
  notify = vi.spyOn(fakeBrowser.notifications, 'create').mockResolvedValue('');
  vi.spyOn(fakeBrowser.notifications, 'clear').mockResolvedValue(true);
  vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({ icons: { 128: 'icon/128.png' } } as never);
  await fakeBrowser.tabs.create({ url: 'https://news.example/', active: true });
  servePhone();
});

const tabs = () => fakeBrowser.tabs.query({});
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('the phone session', () => {
  test('starts with a mirror tab beside the one the user is on, holding the phone’s tabs', async () => {
    const started = await startPhone(SERIAL);
    expect(started.ok).toBe(true);
    const session = await readPhone();
    expect(session).toMatchObject({ serial: SERIAL, model: 'Pixel 8', transport: 'usb', targets: OPENED.targets, waitingForChrome: false });
    const mirror = await fakeBrowser.tabs.get(session!.mirrorTabId);
    expect(mirror.url).toMatch(/phone\.html$/);
    expect(notify).not.toHaveBeenCalled();
  });

  test('a second start shows the mirror already open, and asks the Bridge nothing', async () => {
    await startPhone(SERIAL);
    const first = await readPhone();
    await startPhone(SERIAL);
    expect(socket.openPhone).toHaveBeenCalledTimes(1);
    expect((await readPhone())?.mirrorTabId).toBe(first?.mirrorTabId);
    expect((await tabs()).filter((tab) => tab.url?.endsWith('phone.html'))).toHaveLength(1);
  });

  test('turning it off closes the session and its mirror', async () => {
    await startPhone(SERIAL);
    const { mirrorTabId } = (await readPhone())!;
    await endPhone('closed');
    expect(socket.closePhone).toHaveBeenCalledWith(SERIAL);
    expect(await readPhone()).toBeNull();
    expect((await tabs()).some((tab) => tab.id === mirrorTabId)).toBe(false);
  });

  test('closing the mirror tab turns it off', async () => {
    await startPhone(SERIAL);
    const { mirrorTabId, windowId } = (await readPhone())!;
    await fakeBrowser.tabs.onRemoved.trigger(mirrorTabId, { windowId, isWindowClosing: false });
    await settle();
    expect(await readPhone()).toBeNull();
    expect(socket.closePhone).toHaveBeenCalledWith(SERIAL);
  });

  test('the phone going away ends it but keeps the mirror, to say why; Reconnect reuses that tab', async () => {
    await startPhone(SERIAL);
    const { mirrorTabId } = (await readPhone())!;
    socket.phoneClosed.forEach((listener) => listener(SERIAL, 'unplugged'));
    await settle();
    expect((await readPhone())?.ended?.reason).toBe('unplugged');
    expect((await fakeBrowser.tabs.get(mirrorTabId)).id).toBe(mirrorTabId);
    expect(socket.closePhone).not.toHaveBeenCalled();

    await startPhone(SERIAL);
    const reopened = await readPhone();
    expect([reopened?.mirrorTabId, reopened?.ended]).toEqual([mirrorTabId, undefined]);
  });

  test('the Bridge going away ends it the same way', async () => {
    await startPhone(SERIAL);
    socket.daemonClosed.forEach((listener) => listener());
    await settle();
    expect((await readPhone())?.ended?.reason).toBe('bridge-gone');
  });

  test('another phone’s close leaves this session alone', async () => {
    await startPhone(SERIAL);
    socket.phoneClosed.forEach((listener) => listener('R5CT1234567', 'unplugged'));
    await settle();
    expect((await readPhone())?.ended).toBeUndefined();
  });

  test('Chrome closed on the phone opens the mirror anyway, once, with a notification that can open it', async () => {
    socket.openPhone.mockResolvedValueOnce(failure('CHROME_NOT_RUNNING', 'Chrome is not open on the phone.'));
    await fakeBrowser.storage.session.set({ 'browsentic/daemon': { android: { devices: [{ serial: SERIAL, model: 'Pixel 8' }] } } });
    expect((await startPhone(SERIAL)).ok).toBe(true);
    expect(await readPhone()).toMatchObject({ waitingForChrome: true, targets: [] });
    expect(notify).toHaveBeenCalledWith(
      'browsentic/phone-chrome',
      expect.objectContaining({ title: 'Open Chrome on your phone', message: 'Browsentic needs Chrome running on Pixel 8 to show and drive it.', buttons: [{ title: 'Open Chrome' }] }),
    );

    expect((await openChromeOnPhone()).ok).toBe(true);
    expect(socket.launchPhoneChrome).toHaveBeenCalledWith(SERIAL);
    expect(await readPhone()).toMatchObject({ waitingForChrome: false, targets: OPENED.targets });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  test('Reconnect keeps the numbers the phone’s tabs already had in this conversation', async () => {
    await startPhone(SERIAL);
    await updatePhone((session) => ({ ...session, tabNumbers: { ['A'.repeat(32)]: 3 } }));
    socket.phoneClosed.forEach((listener) => listener(SERIAL, 'unplugged'));
    await settle();
    await startPhone(SERIAL);
    expect((await readPhone())?.tabNumbers).toEqual({ ['A'.repeat(32)]: 3 });
  });

  test('moving to another phone that cannot be opened leaves the first one on', async () => {
    await startPhone(SERIAL);
    socket.openPhone.mockResolvedValueOnce(failure('NOT_OWNER', 'Another browser is driving this phone.'));
    expect(await startPhone('R5CT1234567')).toMatchObject({ ok: false, error: { code: 'NOT_OWNER' } });
    expect(socket.closePhone).not.toHaveBeenCalled();
    expect(await readPhone()).toMatchObject({ serial: SERIAL });
    expect((await readPhone())?.ended).toBeUndefined();
  });

  test('moving to another phone closes the first only once the second is open, in the same tab', async () => {
    await startPhone(SERIAL);
    const { mirrorTabId } = (await readPhone())!;
    expect((await startPhone('R5CT1234567')).ok).toBe(true);
    expect(socket.closePhone).toHaveBeenCalledWith(SERIAL);
    expect(socket.openPhone.mock.invocationCallOrder[1]).toBeLessThan(socket.closePhone.mock.invocationCallOrder[0]);
    expect(await readPhone()).toMatchObject({ serial: 'R5CT1234567', mirrorTabId });
  });

  test('a worker that starts with a session in storage ends it: the Bridge let go of the phone with the old worker’s link', async () => {
    await startPhone(SERIAL);
    servePhone();
    await settle();
    expect((await readPhone())?.ended?.reason).toBe('bridge-gone');
  });

  test('a mirror tab the user takes to another page ends the session and keeps the tab', async () => {
    await startPhone(SERIAL);
    const { mirrorTabId } = (await readPhone())!;
    const mirror = await fakeBrowser.tabs.get(mirrorTabId);
    await fakeBrowser.tabs.onUpdated.trigger(mirrorTabId, { url: 'https://mail.example/' }, { ...mirror, url: 'https://mail.example/' });
    await settle();
    expect(await readPhone()).toBeNull();
    expect(socket.closePhone).toHaveBeenCalledWith(SERIAL);
    expect((await fakeBrowser.tabs.get(mirrorTabId)).id).toBe(mirrorTabId);
  });

  test('any other page counts as leaving the mirror, never the mirror page itself or a blank tab on the way', () => {
    expect(leftMirror(undefined)).toBe(false);
    expect(leftMirror(fakeBrowser.runtime.getURL('/phone.html'))).toBe(false);
    expect(leftMirror('about:blank')).toBe(false);
    expect(leftMirror('https://mail.example/')).toBe(true);
    expect(leftMirror('chrome://newtab/')).toBe(true);
    expect(leftMirror('file:///Users/me/notes.html')).toBe(true);
  });

  test('any other refusal opens nothing and says why', async () => {
    socket.openPhone.mockResolvedValueOnce(failure('NOT_OWNER', 'Another browser is driving this phone.'));
    expect(await startPhone(SERIAL)).toMatchObject({ ok: false, error: { code: 'NOT_OWNER' } });
    expect(await readPhone()).toBeNull();
    expect((await tabs()).some((tab) => tab.url?.endsWith('phone.html'))).toBe(false);
  });
});
