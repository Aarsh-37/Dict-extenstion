# QuickDefine — Instant Dictionary Extension

A lightweight **Chrome Extension (Manifest V3)** that shows instant dictionary definitions when you select any word on a webpage. Inspired by macOS's "Look Up" feature.

---

## ✨ Features

- **Instant Lookup** — Select any word to see its definition in a popup
- **In-Memory Cache** — Repeated lookups are served instantly (no extra API calls)
- **Audio Pronunciation** — Play the pronunciation of the word
- **Copy to Clipboard** — One-click copy of the definition
- **Keyboard Support** — Press `ESC` to dismiss the popup
- **Scroll to Dismiss** — Popup auto-closes on scroll
- **XSS Safe** — All content is sanitized before rendering
- **Shadow DOM** — Isolated styles prevent conflicts with page CSS

---

## 📁 Project Structure

```
dictExtension/
├── src/
│   ├── utils.js        # Config, utilities, and DictionaryManager
│   ├── style.js        # Injected CSS for the popup (Shadow DOM)
│   ├── content.js      # Content script: selection handling and UI
│   └── background.js   # Service worker (minimal)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── manifest.json       # Chrome Extension Manifest V3
├── package.json
├── .gitignore
└── README.md
```

---

## 🚀 Installation (Developer Mode)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Aarsh-37/Dict-extenstion.git
   cd Dict-extenstion
   ```

2. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (toggle, top-right)
   - Click **Load unpacked**
   - Select the project root folder

3. Done! The extension is now active on all webpages.

---

## 🛠 How It Works

1. User selects text on any webpage
2. Content script (`content.js`) detects the selection
3. `DictionaryManager` checks the in-memory cache
4. If not cached, fetches from [Free Dictionary API](https://dictionaryapi.dev/)
5. Result is rendered in a Shadow DOM popup near the selection

**API Used:** `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`

---

## ⚙️ Technical Stack

| Layer      | Technology              |
|------------|-------------------------|
| Platform   | Chrome Extension MV3    |
| Language   | Vanilla JavaScript ES6+ |
| Styling    | CSS3 (Shadow DOM)       |
| Storage    | In-Memory Cache (Map)   |
| API        | Free Dictionary API     |

---

## 📜 License

MIT License
