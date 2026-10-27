import { failure, success, type ActionResult } from '@/lib/actions/protocol';
import type { AndroidState, PhoneOpened } from '@/lib/phone/types';
import type { CdpRequest, PhoneOwner } from '../android/relay';
import type { Android } from '../android/service';

export const NO_PHONE: AndroidState = {
  enabled: true,
  ready: false,
  adb: { found: true, path: '/fake/adb', version: '1.0.41' },
  devices: [],
  problem: { code: 'NO_DEVICE', message: 'No phone is connected.' },
};

export const READY_PHONE: AndroidState = {
  enabled: true,
  ready: true,
  adb: { found: true, path: '/fake/adb', version: '1.0.41' },
  devices: [
    {
      serial: 'emulator-5554',
      transport: 'usb',
      state: 'ready',
      model: 'Pixel Fold',
      chrome: { installed: true, version: '150.0.7871.186', running: true, debuggable: true },
    },
  ],
};

/** The Bridge's view of the phones, set by the test instead of read from adb. */
export class FakeAndroid implements Android {
  current: AndroidState = NO_PHONE;
  readonly launched: string[] = [];
  /** Every phone request that reached the Bridge's Android half, by the browser that sent it. */
  readonly asked: { owner: string; t: string; serial: string; method?: string }[] = [];
  readonly released: string[] = [];
  /** Set to make every phone request fail inside the Bridge, as a bug there would. */
  broken = false;
  private readonly listeners = new Set<(state: AndroidState) => void>();

  get watchers(): number {
    return this.listeners.size;
  }

  async state(): Promise<AndroidState> {
    return this.current;
  }

  peek(): AndroidState | null {
    return this.watchers ? this.current : null;
  }

  watch(listener: (state: AndroidState) => void): () => void {
    this.listeners.add(listener);
    queueMicrotask(() => this.listeners.has(listener) && listener(this.current));
    return () => this.listeners.delete(listener);
  }

  async launch(serial: string): Promise<ActionResult<AndroidState>> {
    this.breakIfAsked();
    this.launched.push(serial);
    return success(this.current);
  }

  async open(owner: PhoneOwner, serial: string): Promise<ActionResult<PhoneOpened>> {
    this.breakIfAsked();
    this.asked.push({ owner: owner.id, t: 'phoneOpen', serial });
    const device = this.current.devices.find((each) => each.serial === serial);
    return device ? success({ device, targets: [], browserVersion: 'Chrome/150.0.7871.186' }) : failure('NO_DEVICE', 'No such phone.');
  }

  async command(owner: PhoneOwner, request: CdpRequest): Promise<void> {
    this.breakIfAsked();
    this.asked.push({ owner: owner.id, t: 'cdp', serial: request.serial, method: request.method });
    owner.send({ t: 'cdpResult', id: request.id, result: success({ echoed: request.method }) });
  }

  async close(owner: PhoneOwner, serial: string): Promise<void> {
    this.breakIfAsked();
    this.asked.push({ owner: owner.id, t: 'phoneClose', serial });
  }

  async release(owner: PhoneOwner): Promise<void> {
    this.released.push(owner.id);
  }

  async stop(): Promise<void> {
    this.listeners.clear();
  }

  private breakIfAsked(): void {
    if (this.broken) throw new Error('the Android half broke');
  }

  change(next: AndroidState): void {
    this.current = next;
    for (const listener of this.listeners) listener(next);
  }
}
