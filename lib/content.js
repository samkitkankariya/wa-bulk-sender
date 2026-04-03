// content.js — full job runner inside WhatsApp Web tab

const sleep = ms => new Promise(r => setTimeout(r, ms));
let jobPaused = false;
let jobRunning = false;

// Forward logs to extension popup
const origLog = console.log;
console.log = (...args) => {
  origLog(...args);
  if (typeof args[0] === 'string' && args[0].startsWith('[WA Sender]')) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    chrome.runtime.sendMessage({ type: 'LOG', msg }).catch(() => { });
  }
};
const origError = console.error;
console.error = (...args) => {
  origError(...args);
  if (typeof args[0] === 'string' && args[0].startsWith('[WA Sender]')) {
    const msg = '❌ ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    chrome.runtime.sendMessage({ type: 'LOG', msg }).catch(() => { });
  }
};

// Keep page alive
setInterval(() => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })), 20000);

console.log('[WA Sender] Content script loaded ✅');

let autoResumeTimeout = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[WA Sender] Got message:', msg.type);

  if (msg.type === 'PING') {
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'PAUSE_JOB') {
    jobPaused = true;
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'RESUME_JOB') {
    jobPaused = false;
    sendResponse({ ok: true });
    runNextMessage();
    return false;
  }

  if (msg.type === 'START_JOB') {
    if (autoResumeTimeout) clearTimeout(autoResumeTimeout);
    jobRunning = false; // reset so we can restart
    jobPaused = false;
    sendResponse({ ok: true });
    startJob();
    return false;
  }

  return false;
});

async function startJob() {
  if (jobRunning) {
    console.log('[WA Sender] Job already running');
    return;
  }
  console.log('[WA Sender] Starting job...');
  jobRunning = true;
  await runNextMessage();
}

async function runNextMessage() {
  if (jobPaused) {
    console.log('[WA Sender] Paused, stopping loop');
    return;
  }

  const data = await getJob();
  const job = data && data.job;

  console.log('[WA Sender] Job state:', job ? `index=${job.index}/${job.contacts?.length} sent=${job.sent} failed=${job.failed}` : 'NO JOB');

  if (!job || !job.running) {
    console.log('[WA Sender] No active job, stopping');
    jobRunning = false;
    return;
  }

  if (job.index >= job.contacts.length) {
    console.log('[WA Sender] All messages sent!');
    job.running = false;
    await saveJob(job);
    notifyStats();
    jobRunning = false;
    return;
  }

  const contact = job.contacts[job.index];
  const message = personalise(job.message || '', contact);
  console.log(`[WA Sender] Sending to ${contact.phone} (${job.index + 1}/${job.contacts.length})`);

  try {
    await openChat(contact.phone);
    await sleep(2000);
    await typeAndSend(message, job.attachment);
    job.sent++;
    console.log(`[WA Sender] ✅ Sent to ${contact.phone}`);
  } catch (e) {
    console.error(`[WA Sender] ❌ Failed for ${contact.phone}:`, e.message);
    job.failed++;
    job.failedList = job.failedList || [];
    job.failedList.push(contact.phone);
  }

  job.index++;
  await saveJob(job);
  notifyStats();

  if (job.index >= job.contacts.length) {
    console.log('[WA Sender] Job complete!');
    job.running = false;
    await saveJob(job);
    notifyStats();
    jobRunning = false;
    return;
  }

  // Interval before next message
  const delaySec = job.index % 80 === 0
    ? 180 + Math.random() * 120
    : job.intervalMin + Math.random() * Math.max(0, job.intervalMax - job.intervalMin);

  console.log(`[WA Sender] Next message in ${Math.round(delaySec)}s`);

  let remaining = Math.round(delaySec);
  const ticker = setInterval(() => {
    if (jobPaused) { clearInterval(ticker); return; }
    remaining--;
    chrome.runtime.sendMessage({ type: 'COUNTDOWN', secs: remaining }).catch(() => { });
    if (remaining <= 0) clearInterval(ticker);
  }, 1000);

  setTimeout(() => {
    clearInterval(ticker);
    if (!jobPaused) runNextMessage();
  }, delaySec * 1000);
}

// ── Open chat via Search Box (Zero Reload Method) ──
async function openChat(phone) {
  // Ensure we have a '+' for WhatsApp country code parsing, and strip outer noise
  const clean = '+' + phone.replace(/[^0-9]/g, '');
  console.log('[WA Sender] Opening chat for', clean);

  // 1. Click "New Chat" button to reliably reset search state
  const newChatBtnSelectors = [
    'div[title="New chat"]',
    'span[data-icon="new-chat-outline"]',
    'span[data-icon="chat"]'
  ];
  let newChatBtn = null;
  for (const sel of newChatBtnSelectors) {
    newChatBtn = document.querySelector(sel);
    if (newChatBtn) {
      const clickableParent = newChatBtn.closest('[role="button"]') || newChatBtn;
      clickableParent.click();
      break;
    }
  }

  if (!newChatBtn) {
    console.log('[WA Sender] ⚠️ Could not find "New Chat" button, falling back to main search.');
  }

  await sleep(1000);

  // 2. Find search box securely using multiple dynamic strategies
  let searchBox = null;
  const searchBoxSelectors = [
    '#side div[contenteditable="true"]', // Most reliable for global search
    'div[contenteditable="true"][data-tab="3"]',
    'div[title*="Search" i] div[contenteditable="true"]',
    'input[placeholder*="Search" i]',
    'div[contenteditable="true"]' // Global fallback
  ];

  // Try to find the search box, retrying for a few seconds if the drawer is still animating
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const sel of searchBoxSelectors) {
      searchBox = document.querySelector(sel);
      if (searchBox) break;
    }
    if (searchBox) break;
    await sleep(1000);
  }

  if (!searchBox) throw new Error('Could not locate WhatsApp search box');

  console.log('[WA Sender] Typing number into search...');
  searchBox.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  document.execCommand('insertText', false, clean);

  // 3. Wait for directory to search for unsaved number
  await sleep(2500);

  // 4. Click the search result
  // WhatsApp lists unsaved numbers as a clickable item saying "Chat with +XX..."
  let targetNode = null;
  const elements = document.querySelectorAll('div[role="listitem"], div[role="button"]');
  const strippedClean = clean.replace(/[^0-9]/g, '');

  for (const el of elements) {
    const text = (el.innerText || '').toLowerCase();
    const strippedText = text.replace(/[^0-9]/g, '');
    if ((strippedText.includes(strippedClean) && strippedClean.length > 5) || text.includes('chat with')) {
      targetNode = el;
      break;
    }
  }

  // Press Enter if listitem isn't obvious, otherwise click it
  if (!targetNode && searchBox) {
    console.log('[WA Sender] Targeting first result by pressing Enter');
    searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    await sleep(1500);
  } else if (targetNode) {
    console.log('[WA Sender] Clicking contact in search results');
    targetNode.click();
    await sleep(1500);
  }

  // 5. Verify the chat compose box opened
  const box = await waitFor('[data-testid="conversation-compose-box-input"]', 8000)
    || await waitFor('div[contenteditable="true"][data-tab="10"]', 2000)
    || await waitFor('footer div[contenteditable="true"]', 2000);

  if (!box) {
    // Check if invalid popup appeared
    const cancelBtn = document.querySelector('[data-testid="popup-controls-cancel"]') || document.querySelector('div[role="button"][aria-label="Cancel"]');
    if (cancelBtn) cancelBtn.click();

    // Close the new chat menu if stuck
    const backBtn = document.querySelector('span[data-icon="back"]');
    if (backBtn) backBtn.click();

    throw new Error(`Invalid number / Not on WhatsApp / Box didn't open`);
  }

  console.log('[WA Sender] Chat opened ✅');
}

// ── Type message into compose box and send ──
async function typeAndSend(message, attachment) {
  let mainBox = document.querySelector('[data-testid="conversation-compose-box-input"]')
    || document.querySelector('div[contenteditable="true"][data-tab="10"]')
    || document.querySelector('footer div[contenteditable="true"]');

  if (!mainBox) throw new Error('Compose box not found for typing');

  // Helper to click all visible send buttons
  const executeSendClick = async () => {
    const sendBtns = Array.from(document.querySelectorAll('[data-testid="send"], span[data-icon="send"], [aria-label="Send"]'));
    const visibleBtns = sendBtns.filter(b => {
      const rect = b.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (visibleBtns.length) {
      console.log(`[WA Sender] Found ${visibleBtns.length} visible send buttons. Clicking...`);
      for (let i = visibleBtns.length - 1; i >= 0; i--) {
        const rawBtn = visibleBtns[i];
        const btn = rawBtn.closest('[role="button"]') || rawBtn.closest('button') || rawBtn;
        btn.click();
        await sleep(150);
      }
    } else {
      console.log('[WA Sender] No send button found, pressing Enter heavily');
      const activeEl = document.activeElement || mainBox;
      activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      activeEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }
  };

  if (attachment) {
    console.log('[WA Sender] Attaching file: ' + attachment.name);
    try {
      const res = await fetch(attachment.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], attachment.name, { type: attachment.type });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      let inputSuccess = false;
      // Try file input method first (most reliable for videos)
      const attachBtn = document.querySelector('div[title="Attach"]') ||
                        document.querySelector('span[data-icon="attach-menu-plus"]')?.closest('[role="button"]') ||
                        document.querySelector('span[data-icon="plus"]')?.closest('[role="button"]') ||
                        document.querySelector('span[data-icon="clip"]')?.closest('[role="button"]');
      
      if (attachBtn) {
          attachBtn.click();
          await sleep(500); // Wait for menu to open and file inputs to render
          
          let fileInput = document.querySelector('input[type="file"][accept*="video"]') || 
                            document.querySelector('input[type="file"][accept*="image"]') ||
                            document.querySelector('input[type="file"]');
                            
          if (fileInput) {
              fileInput.files = dataTransfer.files;
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
              inputSuccess = true;
          } else {
              // If we clicked attach but no input appeared, click again to close the menu
              attachBtn.click();
              await sleep(200);
          }
      }

      // Fallback for older WA versions or if menu didn't open
      if (!inputSuccess) {
          console.log('[WA Sender] File input method failed, falling back to drop/paste events');
          const dropZone = document.querySelector('[data-testid="conversation-panel-wrapper"]') || document.body;
          ['dragenter', 'dragover', 'drop'].forEach(eventName => {
              const dropEvent = new DragEvent(eventName, { bubbles: true, cancelable: true, dataTransfer });
              dropZone.dispatchEvent(dropEvent);
          });

          const pasteEvent = new ClipboardEvent("paste", { clipboardData: dataTransfer, bubbles: true, cancelable: true });
          mainBox.focus();
          mainBox.dispatchEvent(pasteEvent);
      }

      console.log('[WA Sender] Attachment dispatched, waiting for preview modal...');
      await sleep(2500); // Wait for modal to render

      // We are ignoring the caption box entirely as requested. Send the image/video upfront.
      console.log('[WA Sender] Sending attachment alone as requested...');
      await executeSendClick();

      // Wait for modal to disappear and main compose box to be accessible
      await sleep(1500);

      // Random delay before text
      if (message) {
        const randomDelay = 2000 + Math.random() * 2500;
        console.log(`[WA Sender] Attachment sent. Waiting ${Math.round(randomDelay)}ms before typing message...`);
        await sleep(randomDelay);

        // Refresh mainBox reference since DOM might have shifted
        mainBox = document.querySelector('[data-testid="conversation-compose-box-input"]') || 
                  document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                  document.querySelector('footer div[contenteditable="true"]');
      }
    } catch (e) {
      console.error('[WA Sender] Failed to attach:', e.message);
    }
  }

  if (message) {
    console.log('[WA Sender] Typing message...');
    mainBox.focus();
    await sleep(200);

    // Clear first
    document.execCommand('selectAll', false, null);
    await sleep(100);
    document.execCommand('delete', false, null);
    await sleep(200);

    // Type line by line
    const lines = message.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 0) {
        document.execCommand('insertText', false, lines[i]);
        // Random typing speed humanization
        const typeSpeed = 20 + Math.random() * 50;
        await sleep(typeSpeed);
      }
      if (i < lines.length - 1) {
        mainBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        await sleep(50);
      }
    }

    await sleep(600);
    await executeSendClick();
  }

  await sleep(1200);
}

// ── Helpers ──
function waitFor(selector, timeout = 8000) {
  return new Promise(resolve => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);
    const t = setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { clearTimeout(t); obs.disconnect(); resolve(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
}

function personalise(tpl, c) {
  if (!tpl) return '';
  return tpl
    .replace(/\{WhatsApp Number\}/gi, c.phone)
    .replace(/\{First Name\}/gi, c.firstName)
    .replace(/\{Last Name\}/gi, c.lastName)
    .replace(/\{Other\}/gi, c.other);
}

function getJob() {
  return new Promise(resolve => chrome.storage.local.get('job', resolve));
}

function saveJob(job) {
  return new Promise(resolve => chrome.storage.local.set({ job }, resolve));
}

function notifyStats() {
  chrome.runtime.sendMessage({ type: 'STATS_UPDATE' }).catch(() => { });
}

// Auto-resume if a job was running before the page reloaded
getJob().then(data => {
  if (data && data.job && data.job.running && !data.job.paused) {
    console.log('[WA Sender] Resuming job automatically after reload...');
    autoResumeTimeout = setTimeout(startJob, 3000); // Give WA Web some time to initialize
  }
});
