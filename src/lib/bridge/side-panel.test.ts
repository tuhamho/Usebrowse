import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { LAUNCHER_PAGE, openPanelFromToolbar } from './side-panel';

function toolbar(sidePanel: object | undefined) {
  Object.assign(fakeBrowser, { sidePanel });
  return vi.spyOn(fakeBrowser.action, 'setPopup').mockResolvedValue();
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (fakeBrowser as { sidePanel?: unknown }).sidePanel;
  fakeBrowser.reset();
});

describe('openPanelFromToolbar', () => {
  it('has the toolbar button open the side panel, with no popup in the way', async () => {
    const setPanelBehavior = vi.fn(async () => {});
    const setPopup = toolbar({ setPanelBehavior });

    await openPanelFromToolbar();

    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
    expect(setPopup).not.toHaveBeenCalled();
  });

  it('keeps the launcher popup where the browser has no side panel', async () => {
    const setPopup = toolbar(undefined);

    await openPanelFromToolbar();

    expect(setPopup).toHaveBeenCalledWith({ popup: LAUNCHER_PAGE });
  });

  it('keeps the launcher popup where the side panel refuses the behaviour', async () => {
    const setPopup = toolbar({ setPanelBehavior: vi.fn(async () => Promise.reject(new Error('not supported'))) });

    await openPanelFromToolbar();

    expect(setPopup).toHaveBeenCalledWith({ popup: LAUNCHER_PAGE });
  });
});
