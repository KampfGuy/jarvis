# "Hey Siri, Jarvis": iPhone Shortcut

This Shortcut sends what you say to the Jarvis API and reads the reply aloud. It works from Siri, the lock screen, the Action Button and the home screen, with no app open.

**API endpoint:** `POST https://grokchan-api.kampfguy.workers.dev/jarvis`
**Request body (JSON):** `{"text": "your question"}`, optionally with `"model"` set to one of `nvidia/nemotron-3-ultra-550b-a55b:free` (default), `nvidia/nemotron-3-super-120b-a12b:free`, `nvidia/nemotron-3.5-super-vl:free`, `poolside/laguna-s-2.1:free`, `google/gemma-4-31b-it:free` (unknown values use the default; busy models fall back to the others)
**Required header:** `X-Access-Password: <your access password>`
**Response:** `{"reply": "plain-text answer", "model": "model that answered"}`

## Build it (Shortcuts app, about 2 minutes)

1. Open **Shortcuts**, tap **+** (top right) to make a new shortcut, then tap the name at the top and rename it to **Jarvis**.
2. **Dictate Text**: search for the action "Dictate Text" and add it.
   - Optional: tap the arrow on the action and set *Stop Listening* to **After Pause** and *Language* to **English**.
3. **Get Contents of URL**: add it, then:
   - URL: `https://grokchan-api.kampfguy.workers.dev/jarvis`
   - Tap the arrow (**Show More**):
     - **Method**: `POST`
     - **Headers**: tap *Add new header*. Key: `X-Access-Password`, Value: *your access password* (the one you type into the Jarvis web app).
     - **Request Body**: `JSON`
     - Tap *Add new field*, choose **Text**. Key: `text`, Value: tap the field and pick the magic variable **Dictated Text**.
4. **Get Dictionary Value**: add it and set it to *Get* **Value** for key `reply` in **Contents of URL**.
5. **Speak Text**: add it, input **Dictionary Value**.
   - Optional: tap the arrow, set *Language* to **English (UK)** and *Voice* to **Daniel** for the full J.A.R.V.I.S. effect (Settings > Accessibility > Spoken Content > Voices > English > Daniel lets you download the enhanced version).
   - Optional: add **Show Result** (Dictionary Value) if you also want the text on screen.
6. Tap **Done**.

Now say **"Hey Siri, Jarvis"**. Siri runs the shortcut, listens, then speaks Jarvis's answer.

### Extras
- **Action Button / Back Tap:** Settings > Action Button > Shortcut > Jarvis (iPhone 15 Pro and later), or Settings > Accessibility > Touch > Back Tap.
- **Home screen icon:** in the shortcut, tap the share icon and choose **Add to Home Screen**.
- **Errors:** an error saying the dictionary has no `reply` value usually means the password is wrong (the server answers `{"error":"unauthorized"}`, HTTP 401) or the free AI models are busy (`{"error":"All models failed …"}`). Try again in a moment.
- Each Shortcut call is a fresh, one-off question. It has no memory of earlier questions; the web app keeps conversation history.

## Test from a terminal
```bash
curl -s -X POST https://grokchan-api.kampfguy.workers.dev/jarvis \
  -H "Content-Type: application/json" \
  -H "X-Access-Password: YOUR_PASSWORD" \
  -d '{"text":"Jarvis, are you there?"}'
# {"reply":"Always, sir. ..."}
```
