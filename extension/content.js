const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();

function snapshot() {
  const title = document.title;
  const text = clean(document.body?.innerText).slice(0, 18000);
  const elements = [...document.querySelectorAll('a[href],input,textarea,select,button,[role="button"]')].slice(0, 140);
  const indices = new Map(elements.map((el, i) => [el, i]));
  const links = elements.filter((el) => el.matches('a[href]')).slice(0, 80).map((a) => ({
    index: indices.get(a), text: clean(a.innerText || a.getAttribute('aria-label')), href: a.href,
  })).filter((a) => a.text);
  const controls = elements.filter((el) => !el.matches('a[href]')).slice(0, 100).map((el) => ({
    index: indices.get(el), tag: el.tagName.toLowerCase(), type: el.type || '',
    text: clean(el.innerText || el.getAttribute('aria-label') || el.placeholder || el.name),
    value: 'value' in el ? el.value : '', disabled: !!el.disabled,
  }));
  return { url: location.href, title, text, links, controls };
}

function pick(selector) {
  if (selector && /^\d+$/.test(String(selector))) {
    return document.querySelectorAll('a[href],button,input,textarea,select,[role="button"]')[Number(selector)] || null;
  }
  return document.querySelector(selector);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.type === 'snapshot') return sendResponse({ ok: true, data: snapshot() });
    if (message.type === 'click') {
      const el = pick(message.selector);
      if (!el) throw new Error('Could not find that element. Use the page snapshot to choose a selector or index.');
      el.scrollIntoView({ block: 'center' }); el.click();
      return sendResponse({ ok: true, data: `Clicked ${clean(el.innerText || el.getAttribute('aria-label') || el.tagName)}` });
    }
    if (message.type === 'fill') {
      const el = pick(message.selector);
      if (!el || !('value' in el)) throw new Error('Could not find an editable field.');
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
      setter ? setter.call(el, message.value) : el.value = message.value;
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return sendResponse({ ok: true, data: `Filled ${clean(el.getAttribute('aria-label') || el.name || el.placeholder) || 'field'}` });
    }
    if (message.type === 'scroll') {
      window.scrollBy({ top: Math.max(-1200, Math.min(1200, Number(message.pixels) || 600)), behavior: 'smooth' });
      return sendResponse({ ok: true, data: 'Scrolled page.' });
    }
    sendResponse({ ok: false, error: 'Unsupported page action.' });
  } catch (error) { sendResponse({ ok: false, error: error.message }); }
});
