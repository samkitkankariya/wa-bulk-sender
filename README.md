# WA Bulk Message Sender — Chrome Extension

A pixel-perfect clone of WADesk's bulk WhatsApp sender. Built for personal use.

---

## 📁 File Structure

```
wa-bulk-sender/
├── manifest.json          — Extension manifest (v3)
├── popup.html             — Main UI
├── popup.js               — UI logic
├── background.js          — Job orchestrator (service worker)
├── lib/
│   ├── content.js         — WhatsApp Web helper script
│   └── xlsx.full.min.js   — SheetJS (YOU MUST DOWNLOAD THIS)
└── icons/
    └── (icons go here)
```

---

## ⚠️ ONE-TIME SETUP: Download SheetJS

Before loading the extension, you must download SheetJS manually:

1. Go to: https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
2. Save the file as `lib/xlsx.full.min.js` inside this folder

---

## 🚀 Installation

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `wa-bulk-sender` folder
5. Pin the extension to your toolbar

---

## 📋 How to Use

1. **Open WhatsApp Web** at https://web.whatsapp.com and scan QR code
2. Click the extension icon in Chrome toolbar
3. Click **Excel Template** to download the template
4. Fill in your contacts in the Excel file:
   - Column A: WhatsApp Number (with country code, e.g. `+919876543210`)
   - Column B: First Name *(optional)*
   - Column C: Last Name *(optional)*
   - Column D: Other *(optional custom field)*
5. Click **Upload Excel** and select your filled file
6. Type your message. Use personalization tags:
   - `{WhatsApp Number}` — inserts the contact's phone number
   - `{First Name}` — inserts first name
   - `{Last Name}` — inserts last name
   - `{Other}` — inserts the Other column value
7. Set **sending interval** (e.g. 6~10 seconds between messages)
8. Click **Send**
9. Monitor progress in the **Statistics** tab

---

## ⚙️ Features

| Feature | Supported |
|---|---|
| Upload Excel (.xlsx) | ✅ |
| Personalized messages | ✅ |
| Random send interval | ✅ |
| Progress statistics | ✅ |
| Pause / Resume | ✅ |
| Export results to Excel | ✅ |
| Retry failed messages | ✅ |
| Save/load templates | ✅ |
| Auto group pause (every 80 msgs) | ✅ |
| Delete conversation after send | ✅ |

---

## ⚠️ Important Notes

- **Keep WhatsApp Web open** in a Chrome tab while sending — do not close or refresh it
- The extension controls WhatsApp Web automatically; do not interact with it while sending
- Use reasonable intervals (6–15 seconds) to avoid WhatsApp rate limiting
- This is for personal use only

---

## 🔧 Troubleshooting

**Messages not sending?**
- Make sure WhatsApp Web is open and logged in
- Try refreshing WhatsApp Web, then click Send again

**"Input not found" errors?**
- WhatsApp Web may have updated its layout — the selectors in `background.js` may need updating

**Extension not appearing?**
- Make sure `xlsx.full.min.js` is in the `lib/` folder
- Check `chrome://extensions` for any errors
