# QuickDefine - Chrome Extension

### Instant Dictionary Definitions at Your Fingertips

QuickDefine is a lightweight Chrome Extension (Manifest V3) that provides instant dictionary definitions for selected text on any webpage. Inspired by macOS's "Look Up" feature, it's designed for speed, privacy, and a seamless user experience.

## ✨ Features

- **Instant Definitions**: Select a word or phrase (up to 5 words) to get an immediate definition popup.
- **3-Layer Hybrid Cache**: Ultra-fast lookups powered by an In-Memory hot cache, a local IndexedDB dictionary (50,000+ words), and a Free Dictionary API fallback.
- **Offline Support**: Access definitions for preloaded words even without an internet connection.
- **Elegant UI**: Minimalist, Apple-like design with smooth animations, isolated by Shadow DOM to prevent website style conflicts.
- **Smart Positioning**: The definition popup intelligently positions itself to stay within the viewport.
- **Audio Pronunciation**: Listen to word pronunciations (when available).
- **Copy to Clipboard**: Easily copy definitions to your clipboard.
- **Keyboard Shortcuts**: Press `ESC` to quickly dismiss the popup.
- **Performance Optimized**: Debounced selection events, request cancellation, retry logic, and efficient DOM handling.
- **Secure & Private**: XSS protection, strict Content Security Policy, and no user data collection.

## 🚀 Installation (Developer Mode)

1.  **Clone or Download**: Get the project code.
    ```bash
    git clone https://github.com/yourusername/quickdefine.git
    cd quickdefine
    ```

2.  **Add Icons**: Place your `icon16.png`, `icon48.png`, and `icon128.png` files into the `icons/` directory. See `icons/README.md` for details.

3.  **Load Extension**: 
    *   Open Chrome and go to `chrome://extensions/`.
    *   Enable **Developer mode** (top-right toggle).
    *   Click **Load unpacked**.
    *   Select the `quickdefine` (or `hii`) project directory.

4.  **Verify**: QuickDefine will appear in your extensions list and be active on all webpages.

## 📚 Usage

1.  **Select Text**: On any webpage, highlight a word or a short phrase (up to 5 words).
2.  **View Definition**: Release the mouse button, and the definition popup will appear.
3.  **Interact**: 
    *   Click the **🔊** button for pronunciation.
    *   Click the **📋** button to copy the definition.
    *   Press **`ESC`** or click outside the popup to close it.

## ⚙️ Technical Details

- **Platform**: Chrome Extension (Manifest V3)
- **Tech Stack**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Local Database**: IndexedDB for persistent storage of dictionary data.
- **External API**: Free Dictionary API (`https://api.dictionaryapi.dev/api/v2/entries/en/{word}`) for fallback definitions.
- **Background Service Worker**: Manages dictionary preloading on install.

## 📁 Project Structure

```
quickdefine/
├── manifest.json       # Extension manifest
├── background.js       # Service worker for preloading
├── constants.js        # Global configuration
├── db.js               # IndexedDB wrapper
├── utils.js            # General utility functions
├── style.js            # Injected CSS styles
├── content.js          # Main content script
├── dictionary.json     # Placeholder for preloaded dictionary data
├── package.json        # Project metadata & scripts
├── .gitignore          # Git ignore rules
├── icons/              # Extension icons
│   └── README.md       # Icon specifications
└── README.md           # This file
```

## 🛠️ Development & Customization

-   **Dictionary Data**: The `dictionary.json` file is currently a placeholder. Replace it with a comprehensive list of words and their definitions for a truly vast local database. See `DICTIONARY_SETUP.md` (if available) for detailed guidance on preparing and loading custom dictionary data.
-   **Configuration**: Adjust settings like `MAX_WORDS`, cache sizes, and API timeouts in `constants.js`.
-   **Packaging**: Use `npm run package` to create a `.zip` file for distribution.

## 📝 License

MIT License

## ❤️ Credits

-   Free Dictionary API: [dictionaryapi.dev](https://dictionaryapi.dev/)

---*This README is auto-generated and reflects the current state of the QuickDefine project.*
