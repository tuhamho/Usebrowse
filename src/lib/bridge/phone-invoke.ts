import { browser } from 'wxt/browser';
import { z } from 'zod';
import { ActionError } from '@/lib/actions/core';
import { closeTab } from '@/lib/actions/page/close-tab';
import { injectCode } from '@/lib/actions/page/inject-code';
import { navigate, resolveNavigation, type NavigateInput } from '@/lib/actions/page/navigate';
import { openTab } from '@/lib/actions/page/open-tab';
import { runCode } from '@/lib/actions/page/run-code';
import { switchTab } from '@/lib/actions/page/switch-tab';
import { failure, success, type ActionResult } from '@/lib/actions/protocol';
import { EXPIRED_MESSAGE, REFUSED_MESSAGE } from '@/lib/secrets';
import { notOnPhone, phoneOffers } from '@/lib/phone/features';
import type { PhoneTarget } from '@/lib/phone/types';
import { currentTarget, isLive, readPhone, targetForNumber, updatePhone, numbered, type PhoneSession } from './phone';
import { installToolkit, runToolkit, tabPlace, type ToolkitPlace } from './code-toolkit';
import { hereOn, pageSideOnPhone, phoneToolkitPlace, phoneUrls, waitForLoad } from './phone-backend';
import { attachedSession, bringToFront, followTarget } from './phone-mirror';
import { releaseForAction, sealForPage } from './secret-vault';
import { refusalFor, siteCheck } from './site-guard';
import { sendCdp } from './socket';
import { sessionForRun, type TabSession } from './tab-sessions';

const GONE = 'The phone disconnected. Reconnect it and switch Android on again.';

/** These pick another phone tab to land on or close, and check that tab where they pick it. */
const PICKS_ITS_TAB = new Set([openTab, switchTab, closeTab].map((action) => action.name));

type PhoneBackend = (action: string, input: unknown, phone: PhoneSession) => Promise<ActionResult>;

/**
 * The phone session a call belongs to: its run's conversation lives on the phone tab, or, with no
 * run, the tab it resolves to is the phone tab. Null for every desktop call.
 */
export async function phoneRoute(tabId: number | undefined, runId: string | undefined): Promise<PhoneSession | 'gone' | null> {
  const owner: TabSession | null = runId ? await sessionForRun(runId) : null;
  const phone = await readPhone();
  if (owner) return owner.phone ? (phone && isLive(phone) && phone.serial === owner.phone.serial ? phone : 'gone') : null;
  if (!phone) return null;
  const tab = tabId ?? (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (tab !== phone.mirrorTabId) return null;
  return isLive(phone) ? phone : 'gone';
}

export { currentTarget };

export async function invokeOnPhone(action: string, input: unknown, route: PhoneSession | 'gone'): Promise<ActionResult> {
  if (route === 'gone') return failure('PHONE_GONE', GONE);
  if (!phoneOffers(action)) return failure('NOT_ON_PHONE', notOnPhone(action));

  const refused = await guardPhone(action, input, route);
  if (refused) return refused;

  const release = await releaseForAction(action, input);
  if (release.refused.length) return failure('SECRET_NOT_RELEASABLE', REFUSED_MESSAGE);
  if (release.unresolved.length) return failure('SECRET_EXPIRED', EXPIRED_MESSAGE);

  const result = await (TAB_TOOLS[action] ?? pageSideOnPhone)(action, release.input, route);
  const after = (await readPhone()) ?? route;
  const landed = await guardPhoneLanding(action, result, after);
  if (landed) return landed;
  const { value } = await sealForPage(result, hostOf(currentTarget(after)?.url));
  return value;
}

/** The phone's blocked-sites gate, as `guardTarget` is the desktop's: the tab's address, every frame on the focused path, and wherever the action would send the phone. */
async function guardPhone(action: string, input: unknown, phone: PhoneSession): Promise<ActionResult | null> {
  const here = currentTarget(phone)?.url;
  const destinations = destinationsOf(action, input, here);
  if (PICKS_ITS_TAB.has(action)) return refusalFor(...destinations);
  return (await refusalFor(here, ...destinations)) ?? refusalFor(...(await phoneUrls(phone)));
}

/** A redirect, a tap or a slow read can leave the phone somewhere blocked; nothing read there goes back. */
async function guardPhoneLanding(action: string, result: ActionResult, phone: PhoneSession): Promise<ActionResult | null> {
  if (!result.ok || action === switchTab.name || action === closeTab.name) return null;
  const reported = result.data as { tabId?: unknown; finalUrl?: unknown; landedOn?: unknown } | undefined;
  const reportedUrls = [textOf(reported?.finalUrl), textOf(reported?.landedOn)];
  if (action === openTab.name) {
    const opened = typeof reported?.tabId === 'number' ? targetForNumber(phone, reported.tabId) : undefined;
    return refusalFor(phone.targets.find((target) => target.targetId === opened)?.url, ...reportedUrls);
  }
  return refusalFor(...(await phoneUrls(phone)), ...reportedUrls);
}

function destinationsOf(action: string, input: unknown, base?: string): (string | undefined)[] {
  const url = (input as { url?: unknown } | undefined)?.url;
  if ((action !== navigate.name && action !== openTab.name) || typeof url !== 'string') return [];
  try {
    return [new URL(url, base).href];
  } catch {
    return [];
  }
}

const withToolkit =
  (use: typeof installToolkit): PhoneBackend =>
  async (_action, input, phone) => {
    const place = await phoneToolkitPlace(phone);
    return place ? use(place, currentTarget(phone)?.url, input) : failure('PHONE_GONE', GONE);
  };

const TAB_TOOLS: Record<string, PhoneBackend> = {
  [navigate.name]: navigateOnPhone,
  [openTab.name]: openPhoneTab,
  [switchTab.name]: switchPhoneTab,
  [closeTab.name]: closePhoneTab,
  [injectCode.name]: withToolkit(installToolkit),
  [runCode.name]: withToolkit(runToolkit),
};

/** Where `/` runs a saved tool and a kept toolkit is read from: the phone's front tab when the panel is on the phone tab. Null once the phone is gone. */
export async function toolkitPlaceFor(tabId: number, url: string | undefined): Promise<{ place: ToolkitPlace; url: string | undefined } | null> {
  const phone = await phoneRoute(tabId, undefined);
  if (phone === null) return { place: tabPlace(tabId), url };
  if (phone === 'gone') return null;
  const place = await phoneToolkitPlace(phone);
  return place && { place, url: currentTarget(phone)?.url };
}

export async function inCurrentTab(phone: PhoneSession, method: string, params?: Record<string, unknown>) {
  const target = currentTarget(phone);
  const sessionId = target && (await attachedSession(phone.serial, target.targetId));
  return sessionId ? sendCdp(phone.serial, method, params, sessionId) : failure('PHONE_GONE', GONE);
}

async function loaded(phone: PhoneSession): Promise<{ url: string; title: string; loaded: boolean }> {
  const here = await hereOn(phone);
  return here ? waitForLoad(here) : { url: currentTarget(phone)?.url ?? '', title: '', loaded: false };
}

async function navigateOnPhone(_action: string, input: unknown, phone: PhoneSession): Promise<ActionResult> {
  const parsed = navigate.input.safeParse(input ?? {});
  if (!parsed.success) return failure('INVALID_INPUT', z.prettifyError(parsed.error));
  let plan;
  try {
    plan = resolveNavigation(parsed.data as NavigateInput, currentTarget(phone)?.url);
  } catch (error) {
    return error instanceof ActionError ? failure(error.code, error.message) : failure('ACTION_FAILED', String(error));
  }
  if (plan.kind === 'url') {
    const went = await inCurrentTab(phone, 'Page.navigate', { url: plan.href });
    if (!went.ok) return went;
    if (went.data.errorText) return failure('NAVIGATION_FAILED', `The phone could not open ${plan.href}: ${went.data.errorText}`);
    const landing = await loaded(phone);
    return success({ navigatedTo: plan.href, finalUrl: landing.url, title: landing.title, loaded: landing.loaded });
  }
  if (plan.action === 'reload') {
    const reloaded = await inCurrentTab(phone, 'Page.reload');
    if (!reloaded.ok) return reloaded;
  } else {
    const history = await inCurrentTab(phone, 'Page.getNavigationHistory');
    if (!history.ok) return history;
    const entries = (history.data.entries as { id: number }[] | undefined) ?? [];
    const entry = entries[Number(history.data.currentIndex) + (plan.action === 'back' ? -1 : 1)];
    if (!entry) return failure('ACTION_FAILED', `Cannot go ${plan.action}: this phone tab has no ${plan.action === 'back' ? 'previous' : 'next'} page in its history.`);
    const went = await inCurrentTab(phone, 'Page.navigateToHistoryEntry', { entryId: entry.id });
    if (!went.ok) return went;
  }
  const landing = await loaded(phone);
  return success({ performed: plan.action, finalUrl: landing.url, title: landing.title, loaded: landing.loaded });
}

async function openPhoneTab(_action: string, input: unknown, phone: PhoneSession): Promise<ActionResult> {
  const parsed = openTab.input.safeParse(input ?? {});
  if (!parsed.success) return failure('INVALID_INPUT', z.prettifyError(parsed.error));
  const { url, active } = parsed.data;
  const previous = currentTarget(phone);
  let href: string;
  try {
    const plan = resolveNavigation({ url }, previous?.url);
    if (plan.kind !== 'url') return failure('INVALID_INPUT', 'page.openTab opens a URL — it has no history to walk.');
    href = plan.href;
  } catch (error) {
    return error instanceof ActionError ? failure(error.code, error.message) : failure('ACTION_FAILED', String(error));
  }
  const created = await sendCdp(phone.serial, 'Target.createTarget', { url: href });
  if (!created.ok) return created;
  const targetId = String(created.data.targetId);
  const held = await updatePhone((session) => numbered(session, session.targets.some((each) => each.targetId === targetId) ? session.targets : [...session.targets, { targetId, url: href, title: '' }]));
  const tabId = held?.tabNumbers?.[targetId];
  if (active === false && previous) {
    await bringToFront(phone.serial, previous.targetId);
    return success({
      performed: `opened ${href} in a new phone tab, then went back to tab ${phone.tabNumbers?.[previous.targetId]}; the phone shows a new tab in front for a moment, since Chrome on Android opens every new tab there`,
      openedUrl: href,
      tabId,
      activeTabId: phone.tabNumbers?.[previous.targetId],
    });
  }
  await followTarget(targetId);
  const landing = await loaded({ ...phone, ...held, activeTargetId: targetId });
  return success({ performed: `opened ${href} in a new phone tab`, openedUrl: href, finalUrl: landing.url, tabId, loaded: landing.loaded, activeTabId: tabId, previousTabId: previous && phone.tabNumbers?.[previous.targetId] });
}

type Usable = (target: PhoneTarget) => boolean;

/** A phone tab on a blocked site is treated as a desktop one is: never listed, never matched, never named. */
async function usableTargets(): Promise<Usable> {
  const blocked = await siteCheck();
  return (target) => !blocked(target.url);
}

const describeTabs = (phone: PhoneSession, usable: Usable) =>
  phone.targets
    .filter(usable)
    .map((target) => ({ tabId: phone.tabNumbers?.[target.targetId], url: target.url, title: target.title, active: target.targetId === phone.activeTargetId }));

function inventory(phone: PhoneSession, usable: Usable) {
  const tabs = describeTabs(phone, usable);
  const hidden = phone.targets.length - tabs.length;
  return { tabs, ...(hidden ? { hidden } : {}) };
}

const noMatch = (phone: PhoneSession, usable: Usable) => failure('INVALID_TARGET', `No phone tab matches. The phone's tabs: ${JSON.stringify(describeTabs(phone, usable))}`);

function pickTarget(phone: PhoneSession, { tabId, match }: { tabId?: number; match?: string }, usable: Usable): PhoneTarget | undefined {
  if (tabId != null) return phone.targets.find((target) => target.targetId === targetForNumber(phone, tabId));
  if (match == null) return phone.targets.find((target) => target.targetId === phone.activeTargetId);
  const needle = match.toLowerCase();
  return phone.targets.filter(usable).find((target) => `${target.title} ${target.url}`.toLowerCase().includes(needle));
}

async function switchPhoneTab(_action: string, input: unknown, phone: PhoneSession): Promise<ActionResult> {
  const parsed = switchTab.input.safeParse(input ?? {});
  if (!parsed.success) return failure('INVALID_INPUT', z.prettifyError(parsed.error));
  const { tabId, match } = parsed.data;
  const usable = await usableTargets();
  if (tabId == null && match == null) return success(inventory(phone, usable));
  const target = pickTarget(phone, { tabId, match }, usable);
  if (!target) return noMatch(phone, usable);
  const refused = await refusalFor(target.url);
  if (refused) return refused;
  await bringToFront(phone.serial, target.targetId);
  await followTarget(target.targetId);
  return success({ performed: `switched to phone tab ${phone.tabNumbers?.[target.targetId]}`, activeTabId: phone.tabNumbers?.[target.targetId], tab: { url: target.url, title: target.title } });
}

async function closePhoneTab(_action: string, input: unknown, phone: PhoneSession): Promise<ActionResult> {
  const parsed = closeTab.input.safeParse(input ?? {});
  if (!parsed.success) return failure('INVALID_INPUT', z.prettifyError(parsed.error));
  const { tabId, match } = parsed.data;
  const usable = await usableTargets();
  const target = pickTarget(phone, { tabId, match }, usable);
  if (!target) return noMatch(phone, usable);
  const refused = await refusalFor(target.url);
  if (refused) return refused;
  if (phone.targets.length <= 1) return failure('INVALID_TARGET', 'That is the only tab open on the phone. Open another first, or leave this one alone.');
  const closed = await sendCdp(phone.serial, 'Target.closeTarget', { targetId: target.targetId });
  if (!closed.ok) return closed;
  return success({ performed: `closed phone tab ${phone.tabNumbers?.[target.targetId]}`, closed: { url: target.url, title: target.title } });
}

const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

function hostOf(url: string | undefined): string | undefined {
  try {
    return url ? new URL(url).hostname.toLowerCase() || undefined : undefined;
  } catch {
    return undefined;
  }
}
