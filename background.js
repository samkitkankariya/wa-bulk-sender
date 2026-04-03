// background.js — minimal relay
// Popup → background → content script (tabs.sendMessage)
// Content script → background → popup (runtime.sendMessage relay)

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Commands from popup: forward to WhatsApp tab's content script
  if (['START_JOB', 'PAUSE_JOB', 'RESUME_JOB'].includes(msg.type)) {
    chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, tabs => {
      if (!tabs.length) {
        console.warn('[BG] No WhatsApp tab found');
        sendResponse({ ok: false, error: 'No WhatsApp tab' });
        return;
      }
      console.log('[BG] Forwarding', msg.type, 'to tab', tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, msg, resp => {
        if (chrome.runtime.lastError) {
          console.error('[BG] tabs.sendMessage error:', chrome.runtime.lastError.message);
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(resp || { ok: true });
        }
      });
    });
    return true; // keep channel open for async response
  }

  // Stats/countdown/logs go straight to the popup implicitly from the content script.
  if (msg.type === 'STATS_UPDATE' || msg.type === 'COUNTDOWN' || msg.type === 'LOG') {
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
