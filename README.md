# Gridiron Legends

A fan-made football card pack simulator (version 3.6). Open packs, build a collection, and chase autographs and 1/1 Superfractals.

**Play it:** [https://bdh-1.github.io/gridiron-legends/](https://bdh-1.github.io/gridiron-legends/)

## Install on your phone

1. Open the link above in Safari (iPhone) or Chrome (Android).
2. iPhone: tap Share → **Add to Home Screen**.
3. Android: tap the menu → **Install app** or **Add to Home screen**.

The app works offline after the first load. Your progress is saved on this device.

## Saving and backup codes

This site has its own save (it does not automatically share progress with the Cursor Page). To move a collection over:

1. In the game, open **Save** and tap **Copy backup**.
2. On the other copy of the game, paste that code into **Restore from backup code** and tap **Restore from code**.

Codes start with `GL2:`. Restore also accepts a lowercase `gl2:` prefix, extra spaces or line breaks, and a code pasted without the prefix.

If a browser ever blocks saving, copy a backup code before you close the tab.

## Publishing updates

Edits go live after they are pushed to the `main` branch of this repo. GitHub Pages serves the files at the repo root.

```bash
# after changing the game
npm install          # first time only
npm run build        # bundles src/ into app.js
git add -A
git commit -m "Describe the change"
git push origin main
```

A minute or two later, open [the live app](https://bdh-1.github.io/gridiron-legends/) again. The service worker loads `index.html` from the network first so a new version shows on the next open. If you installed it on your iPhone home screen, close the app completely (swipe it away from the app switcher) and tap the icon again.

The title at the top of the game is **Gridiron Legends 26**.
