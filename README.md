# Jarvis

A J.A.R.V.I.S.-style (Iron Man) voice assistant: an installable web app (PWA) built for iPhone.

**Live:** https://kampfguy.github.io/jarvis/

- An Iron Man HUD: an arc-reactor orb that pulses while it listens, thinks and speaks, a conversation transcript, a text box and a big mic button.
- Voice in uses the Web Speech API (`webkitSpeechRecognition`). Where that isn't available, the app falls back to the iOS keyboard's dictation key.
- Voice out uses `speechSynthesis` and prefers a British male voice (iOS "Daniel"). It has a mute toggle and a voice picker in the menu.
- Behind a password gate. Requests go to the `grokchan-api` Cloudflare Worker (`/chat`, character `jarvis`).
- Keeps the last 20 messages as history.
- Works with Siri through an iPhone Shortcut. See [SHORTCUT.md](SHORTCUT.md).

## Install on iPhone
Open the link in **Safari**, tap **Share**, then **Add to Home Screen**, then **Add**.
