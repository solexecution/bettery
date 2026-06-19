# Bettery 💪 — Chest Trainer PWA

An installable, offline-capable Progressive Web App for chest-focused calisthenics.
Starts with **push-ups**: pick a variation, see exactly which muscles it hits on a live
body map, track your sets/reps with a rest timer, and get a notification when rest is over.

## Features
- **8 push-up variations** — knee, incline, standard, wide, diamond, decline, archer, pseudo-planche.
- **Live muscle map** — each variation highlights the worked muscles (upper / mid-lower / inner chest, front delts, triceps, serratus, core) by intensity.
- **Set + rep tracking** — adjustable sets, reps and rest; per-set rep logging; workout history with streak, totals and best set.
- **Rest timer** — animated countdown ring, beep + notification when it ends, skip / +15s controls.
- **Notifications** — rest-over alerts and an optional daily training reminder.
- **PWA** — installable to your home screen, works offline, no native dialogs.

All data lives in your browser (`localStorage`) — nothing leaves the device.

## Run locally
Any static file server works, e.g.:
```bash
npx serve .
# or
python -m http.server 8000
```
Then open the printed URL. (Service workers / install need `http://localhost` or HTTPS — opening the file directly won't register the SW.)

## Deploy to GitHub Pages
1. Create a repo and push this folder's contents to it.
2. In **Settings → Pages**, set *Source* to the `main` branch, root (`/`).
3. Your app will be live at `https://<user>.github.io/<repo>/`.

All paths are relative, so it works at any sub-path. Add it to your phone via the browser's **Install / Add to Home Screen**.

## Regenerate icons
```powershell
./make-icons.ps1
```

## Roadmap
- Pull-ups module (next), with back/biceps muscle map.
- Progress charts and progression suggestions.
