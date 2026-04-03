// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'stats') refreshStats();
    if (tab.dataset.tab === 'more') refreshTemplateList();
  });
});

// ── State ─────────────────────────────────────────────────────────────────────
let contacts = [];     // [{phone, firstName, lastName, other}]
let attachFile = null;

// ── Excel Template Download ───────────────────────────────────────────────────
document.getElementById('btn-download-template').addEventListener('click', () => {
  // Generate CSV (opens in Excel perfectly, no eval/CSP issues)
  const rows = [
    ['WhatsApp Number(with country code)', 'First Name', 'Last Name', 'Other'],
    ['+919876543210', 'John', 'Doe', 'VIP'],
    ['+919876543211', 'Jane', 'Smith', 'Customer'],
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'WADesk_SenderTemplate.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ── Upload Excel ──────────────────────────────────────────────────────────────
document.getElementById('btn-upload-excel').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();

  const processRows = (rows) => {
    contacts = rows
      .map(r => ({
        phone: String(r['WhatsApp Number(with country code)'] || r['WhatsApp Number'] || '').replace(/\s/g,'').replace(/\.0$/, ''),
        firstName: String(r['First Name'] || ''),
        lastName: String(r['Last Name'] || ''),
        other: String(r['Other'] || '')
      }))
      .filter(c => c.phone && c.phone.length > 5);

    document.getElementById('file-name-label').textContent = `✅ ${file.name} — ${contacts.length} contacts loaded`;
    const preview = document.getElementById('contact-preview');
    preview.style.display = 'block';
    preview.textContent = contacts.slice(0, 5).map(c => `${c.phone} ${c.firstName} ${c.lastName}`).join('\n')
      + (contacts.length > 5 ? `\n…and ${contacts.length - 5} more` : '');
    updatePersonalisedTags(rows[0]);
    chrome.storage.local.set({ contacts });
    showAlert(`${contacts.length} contacts loaded successfully.`, 'success');
  };

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    reader.onload = e => {
      const rows = parseCSV(e.target.result);
      processRows(rows);
    };
    reader.readAsText(file);
  } else {
    // xlsx/xls — use SheetJS if available, otherwise alert
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        processRows(rows);
      } catch(err) {
        showAlert('Could not read Excel file. Please save as CSV and upload that instead.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  }
});

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

function updatePersonalisedTags(firstRow) {
  const container = document.getElementById('personalized-tags');
  const defaultVars = [
    { label: 'WhatsApp Number', val: '{WhatsApp Number}' },
    { label: 'First Name', val: '{First Name}' },
    { label: 'Last Name', val: '{Last Name}' },
    { label: 'Other', val: '{Other}' }
  ];
  // Add any extra columns
  if (firstRow) {
    Object.keys(firstRow).forEach(k => {
      if (!defaultVars.find(v => v.label === k)) {
        defaultVars.push({ label: k, val: `{${k}}` });
      }
    });
  }
  container.innerHTML = '';
  defaultVars.forEach(v => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = v.label;
    span.dataset.var = v.val;
    span.addEventListener('click', insertVar);
    container.appendChild(span);
  });
}

// ── Personalized Tag Insertion ────────────────────────────────────────────────
document.querySelectorAll('.tag').forEach(t => t.addEventListener('click', insertVar));

function insertVar(e) {
  const ta = document.getElementById('message-text');
  const v = e.currentTarget.dataset.var;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const text = ta.value;
  ta.value = text.slice(0, start) + v + text.slice(end);
  ta.selectionStart = ta.selectionEnd = start + v.length;
  ta.focus();
}

// ── Quick buttons ─────────────────────────────────────────────────────────────
document.getElementById('btn-apologize').addEventListener('click', () => {
  const ta = document.getElementById('message-text');
  ta.value += '\n\nSorry for the disturbance! 🙏';
});

document.getElementById('btn-timestamp').addEventListener('click', () => {
  const ta = document.getElementById('message-text');
  ta.value += '\n\n[' + new Date().toLocaleString() + ']';
});

// ── Templates ─────────────────────────────────────────────────────────────────
function getTemplates() {
  return JSON.parse(localStorage.getItem('wa_templates') || '[]');
}

function saveTemplates(arr) {
  localStorage.setItem('wa_templates', JSON.stringify(arr));
}

function populateTemplateDropdown() {
  const sel = document.getElementById('template-select');
  const current = sel.value;
  sel.innerHTML = '<option value="">— Select template —</option>';
  getTemplates().forEach((t, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
  sel.value = current;
}

document.getElementById('template-select').addEventListener('change', function () {
  const templates = getTemplates();
  if (this.value !== '') {
    document.getElementById('message-text').value = templates[+this.value].text;
  }
});

document.getElementById('btn-save-template').addEventListener('click', () => {
  const text = document.getElementById('message-text').value.trim();
  if (!text) return showAlert('Message is empty!', 'error');
  const name = prompt('Template name:');
  if (!name) return;
  const templates = getTemplates();
  templates.push({ name, text });
  saveTemplates(templates);
  populateTemplateDropdown();
  showAlert('Template saved!', 'success');
});

function refreshTemplateList() {
  const templates = getTemplates();
  const div = document.getElementById('template-list');
  if (!templates.length) { div.textContent = 'No templates saved yet.'; return; }
  div.innerHTML = '';
  templates.forEach((t, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0;';
    row.innerHTML = `<span style="font-weight:600">${t.name}</span>
      <button style="border:none;background:none;color:#e74c3c;cursor:pointer;font-size:12px" data-i="${i}">🗑</button>`;
    row.querySelector('button').addEventListener('click', () => {
      templates.splice(i, 1);
      saveTemplates(templates);
      refreshTemplateList();
      populateTemplateDropdown();
    });
    div.appendChild(row);
  });
}

document.getElementById('btn-clear-templates').addEventListener('click', () => {
  if (!confirm('Delete all saved templates?')) return;
  saveTemplates([]);
  refreshTemplateList();
  populateTemplateDropdown();
});

populateTemplateDropdown();

// ── Interval controls ─────────────────────────────────────────────────────────
function makeIntervalCtrl(decId, incId, inputId, min, max) {
  document.getElementById(decId).addEventListener('click', () => {
    const el = document.getElementById(inputId);
    const v = Math.max(min, +el.value - 1);
    el.value = v;
  });
  document.getElementById(incId).addEventListener('click', () => {
    const el = document.getElementById(inputId);
    el.value = Math.min(max, +el.value + 1);
  });
}

makeIntervalCtrl('min-dec','min-inc','interval-min', 1, 999);
makeIntervalCtrl('max-dec','max-inc','interval-max', 1, 999);

// ── Attachments ───────────────────────────────────────────────────────────────
document.getElementById('toggle-attachments').addEventListener('change', function () {
  document.getElementById('attach-type-row').style.display = this.checked ? 'flex' : 'none';
  if (!this.checked) {
    attachFile = null;
    document.getElementById('attach-file-label').style.display = 'none';
  }
});

document.querySelectorAll('input[name="attach-type"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('attach-file-input').click();
  });
});

document.getElementById('attach-file-input').addEventListener('change', function () {
  attachFile = this.files[0] || null;
  const label = document.getElementById('attach-file-label');
  if (attachFile) {
    label.style.display = 'block';
    label.textContent = '📎 ' + attachFile.name;
  }
});

// ── Send ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-send').addEventListener('click', async () => {
  const message = document.getElementById('message-text').value.trim();
  if (!message && !attachFile) return showAlert('Please enter a message or attach a file.', 'error');

  // Load contacts from session storage (set after file parse)
  const session = await chrome.storage.local.get('contacts');
  const allContacts = session.contacts || contacts;
  if (!allContacts.length) return showAlert('Please upload an Excel file with contacts.', 'error');

  // Deduplicate
  const seen = new Set();
  const unique = allContacts.filter(c => {
    if (seen.has(c.phone)) return false;
    seen.add(c.phone);
    return true;
  });

  const intervalMin = +document.getElementById('interval-min').value;
  const intervalMax = +document.getElementById('interval-max').value;
  const deleteAfter = document.getElementById('toggle-delete-after').checked;

  // Warn if WhatsApp Web not open
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (!tabs.length) {
    return showAlert('Please open web.whatsapp.com first, then click Send again.', 'error');
  }

  // Handle attachment reading
  let attachmentData = null;
  if (attachFile) {
    try {
      attachmentData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve({
          name: attachFile.name,
          type: attachFile.type,
          dataUrl: e.target.result
        });
        reader.onerror = e => reject(e);
        reader.readAsDataURL(attachFile);
      });
    } catch (err) {
      return showAlert('Failed to read attachment: ' + err.message, 'error');
    }
  }

  const job = {
    contacts: unique,
    message,
    intervalMin,
    intervalMax,
    deleteAfter,
    attachment: attachmentData,
    tabId: tabs[0].id,
    total: unique.length,
    dedup: allContacts.length - unique.length,
    sent: 0,
    failed: 0,
    index: 0,
    paused: false,
    running: true,
    failedList: []
  };

  await new Promise((resolve, reject) => chrome.storage.local.set({ job }, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      showAlert('Failed to save job, file might be too large.', 'error');
      reject(chrome.runtime.lastError);
    } else resolve();
  }));

  // Switch to stats tab first so user sees feedback
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tab[data-tab="stats"]').classList.add('active');
  document.getElementById('tab-stats').classList.add('active');
  refreshStats();

  // Send START_JOB and verify content script received it
  chrome.runtime.sendMessage({ type: 'START_JOB' }, resp => {
    if (chrome.runtime.lastError || (resp && resp.ok === false)) {
      const err = (resp && resp.error) || chrome.runtime.lastError?.message || 'Unknown error';
      showAlert('⚠️ Could not reach WhatsApp tab: ' + err + '. Make sure WhatsApp Web is open and reload the extension.', 'error');
    } else {
      showAlert('✅ Sending started! Check Statistics tab for progress.', 'success');
    }
  });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
let statsInterval = null;

async function refreshStats() {
  const data = await chrome.storage.local.get('job');
  const job = data.job;
  if (!job) return;

  document.getElementById('stat-total').textContent = job.total;
  document.getElementById('stat-dedup').textContent = job.dedup;
  document.getElementById('stat-success').textContent = job.sent;
  document.getElementById('stat-failed').textContent = job.failed;

  const done = job.sent + job.failed;
  const pct = job.total > 0 ? Math.round((done / job.total) * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-count').textContent = `${done}/${job.total}`;

  const dot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  if (job.running && !job.paused) {
    dot.className = 'status-dot running';
    statusText.textContent = 'Running…';
  } else if (job.paused) {
    dot.className = 'status-dot paused';
    statusText.textContent = 'Paused';
  } else {
    dot.className = 'status-dot done';
    statusText.textContent = 'Done';
  }

  document.getElementById('btn-pause').textContent = job.paused ? 'Resume' : 'Pause';
}

// Poll stats every second
document.querySelector('.tab[data-tab="stats"]').addEventListener('click', () => {
  clearInterval(statsInterval);
  statsInterval = setInterval(refreshStats, 1000);
});

// Countdown relay from background
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'COUNTDOWN') {
    document.getElementById('next-countdown').textContent = msg.secs + 's';
  }
  if (msg.type === 'STATS_UPDATE') refreshStats();
  if (msg.type === 'LOG') debugLog(msg.msg);
});

// Pause / Resume
document.getElementById('btn-pause').addEventListener('click', async () => {
  const data = await chrome.storage.local.get('job');
  if (!data.job) return;
  data.job.paused = !data.job.paused;
  await chrome.storage.local.set({ job: data.job });
  chrome.runtime.sendMessage({ type: data.job.paused ? 'PAUSE_JOB' : 'RESUME_JOB' });
  refreshStats();
});

// Export
document.getElementById('btn-export').addEventListener('click', async () => {
  const data = await chrome.storage.local.get('job');
  if (!data.job) return showAlert('No job data.', 'error');
  const headers = ['Phone', 'First Name', 'Last Name', 'Status'];
  const rows = data.job.contacts.map(c => [
    c.phone, c.firstName, c.lastName,
    (data.job.failedList || []).includes(c.phone) ? 'Failed' : 'Sent'
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'WA_Send_Results.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Retry failed
document.getElementById('btn-retry').addEventListener('click', async () => {
  const data = await chrome.storage.local.get('job');
  if (!data.job || !data.job.failedList.length) return showAlert('No failed contacts.', 'error');
  const failedContacts = data.job.contacts.filter(c => data.job.failedList.includes(c.phone));
  data.job.contacts = failedContacts;
  data.job.failedList = [];
  data.job.sent = 0;
  data.job.failed = 0;
  data.job.index = 0;
  data.job.running = true;
  data.job.paused = false;
  await new Promise(resolve => chrome.storage.local.set({ job: data.job }, resolve));
  chrome.runtime.sendMessage({ type: 'START_JOB' });
  refreshStats();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showAlert(msg, type = 'info') {
  const el = document.getElementById('send-alert');
  el.className = 'alert ' + type;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}


// ── Debug ─────────────────────────────────────────────────────────────────────
function debugLog(msg) {
  const el = document.getElementById('debug-log');
  if (!el) return;
  const line = document.createElement('div');
  line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
  // keep last 30 lines
  while (el.children.length > 30) el.removeChild(el.firstChild);
}

document.getElementById('btn-test-ping')?.addEventListener('click', async () => {
  debugLog('Pinging WhatsApp tab...');
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (!tabs.length) {
    debugLog('❌ No WhatsApp tab found! Open web.whatsapp.com first.');
    return;
  }
  debugLog('Found tab: ' + tabs[0].url);
  chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' }, resp => {
    if (chrome.runtime.lastError) {
      debugLog('❌ Content script not responding: ' + chrome.runtime.lastError.message);
      debugLog('→ Try reloading the WhatsApp tab then reload the extension.');
    } else {
      debugLog('✅ Content script is alive! Ready to send.');
    }
  });
});

// Override showAlert to also log to debug
const _origAlert = showAlert;
showAlert = (msg, type = 'info') => {
  _origAlert(msg, type);
  debugLog((type === 'error' ? '❌ ' : 'ℹ️ ') + msg);
};
