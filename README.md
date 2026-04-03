# <img src="icons/icon48.png" width="32" align="top"> WA Bulk Message Sender — Chrome Extension

A robust, feature-rich WhatsApp bulk messenger. Built for personal use and automates sending messages without reloading tabs.

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
│   └── xlsx.full.min.js   — SheetJS (Optional, for .xlsx support)
├── download_sheetjs.sh    — Helper script to download SheetJS (Mac/Linux)
├── download_sheetjs.bat   — Helper script to download SheetJS (Windows)
└── icons/                 — Extension icons
```

---

## ⚠️ ONE-TIME SETUP: Download SheetJS (Optional)

**Note:** If you only use `.csv` files for your contacts (which the template is by default), you **do not** need SheetJS.

If you plan to upload native `.xlsx` or `.xls` Excel files, you must download SheetJS manually:

- **Mac/Linux:** Open terminal in this folder and run `sh download_sheetjs.sh`
- **Windows:** Double-click `download_sheetjs.bat`

Alternatively, download manually:
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

1. **Open WhatsApp Web** at https://web.whatsapp.com and scan your QR code.
2. Click the extension icon in the Chrome toolbar.
3. Click **⬇ Excel Template** to download the CSV template.
4. Fill in your contacts in the downloaded file:
   - Column A: WhatsApp Number (with country code, e.g. `+919876543210`)
   - Column B: First Name *(optional)*
   - Column C: Last Name *(optional)*
   - Column D: Other *(optional custom field)*
5. Click **⬆ Upload Excel** and select your filled file (CSV or XLSX).
6. **(Optional)** Type your message. Use personalization tags:
   - `{WhatsApp Number}` — inserts the contact's phone number
   - `{First Name}` — inserts first name
   - `{Last Name}` — inserts last name
   - `{Other}` — inserts the Other column value
7. **(Optional)** Toggle "Send attachments" to add an image, video, or document. *Note: If an attachment is provided, the message text becomes optional.*
8. Set the **sending interval** (e.g. 6~10 seconds between messages).
9. Click **Send**!
10. Monitor progress, pause, or resume in the **Statistics** tab.

---

## ⚙️ Features

| Feature | Supported |
|---|---|
| Upload CSV (.csv) natively | ✅ |
| Upload Excel (.xlsx) | ✅ (Requires SheetJS) |
| Image, Video, & Document Attachments | ✅ |
| Optional text message with attachments | ✅ |
| Personalized messages | ✅ |
| Random send interval | ✅ |
| Progress statistics & Export Results | ✅ |
| Pause / Resume | ✅ |
| Retry failed messages | ✅ |
| Save/load templates | ✅ |
| Auto group pause (every 80 msgs) | ✅ (3-5 min gap) |
| Delete conversation after send | ✅ |

---

## ⚠️ Important Notes

- **Keep WhatsApp Web open** in a Chrome tab while sending — do not close or refresh it.
- The extension controls WhatsApp Web automatically; do not interact with it while sending.
- Use reasonable intervals (6–15 seconds) to avoid WhatsApp rate limiting. 
- This extension uses an efficient "Zero Reload Method" connecting directly to the Search Box to compose messages.
- This is for personal use only.

---

## 🔧 Troubleshooting

**Messages not sending?**
- Make sure WhatsApp Web is open and fully loaded.
- Try refreshing WhatsApp Web, let it initialize, then click Send again.
- If messages continue to fail, go to the Statistics tab and click "Retry Failed".

**Cannot read Excel files?**
- Make sure you either uploaded a `.csv` file - or if uploading `.xlsx`, that you've downloaded `xlsx.full.min.js`.

**Extension not appearing or loading errors?**
- Check `chrome://extensions` for any errors under the WA Bulk Message Sender.
