import { beforeEach, describe, expect, test } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { ensureSessionForTab, hostOf, siteUrlOf } from './tab-sessions';

const FIREFOX_HOME = 'moz-extension://4f1c2a0e-9b7d-4c51-a3e2-0d6f5b8c9e17/newtab.html';

beforeEach(() => fakeBrowser.reset());

describe('a conversation begun on Browsentic Home in Firefox, which shows the page its own address', () => {
  test('is on no site, so the extension’s id never stands in for a host', async () => {
    const ensured = await ensureSessionForTab({ tabId: 7, windowId: 1, url: FIREFOX_HOME, title: 'New Tab' });
    expect(ensured.ok && ensured.session.host).toBeUndefined();
    expect(hostOf(FIREFOX_HOME)).toBeUndefined();
  });

  test('reaches the Bridge as nowhere in particular, which a blank tab is too', () => {
    expect(siteUrlOf(FIREFOX_HOME)).toBeUndefined();
    expect(siteUrlOf('chrome-extension://abcdefghijklmnopabcdefghijklmnop/newtab.html')).toBeUndefined();
    expect(siteUrlOf(undefined)).toBeUndefined();
  });
});

describe('a conversation on a site', () => {
  test('keeps its host and its address', () => {
    expect(hostOf('https://www.github.com/pulls')).toBe('www.github.com');
    expect(hostOf('http://localhost:5173/')).toBe('localhost:5173');
    expect(siteUrlOf('https://github.com/pulls')).toBe('https://github.com/pulls');
  });

  test('on a local file has no host, as before', () => {
    expect(hostOf('file:///Users/you/notes.html')).toBeUndefined();
  });
});
