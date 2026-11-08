# Bisik

[![Test](https://github.com/aqles/bisik/actions/workflows/test.yml/badge.svg)](https://github.com/aqles/bisik/actions/workflows/test.yml)

A two-person chat that deliberately keeps nothing.

Bisik is a web app (installable as a PWA) for talking 1-on-1 under encryption. No accounts, no contact lists, no database. Two people enter the same code and talk. End the session and the messages end with it — no history left anywhere.

**Try it live: https://bisik.ednasalam.com** (version 0.4.2)

![The Bisik join screen — one code field, one button, nothing else](docs/screenshot.png)

## How to use it

1. Open Bisik and make a random code, or type your own (at least 8 characters).
2. Share that code with your friend through another channel — in person, on a call, on paper. The code is the encryption key, so don't spread it around.
3. Your friend opens Bisik and enters the exact same code — exact means exact, capitals are different characters.
4. Talk as usual. Text and images (up to 5 MB) both work.

There's a 6-character room fingerprint at the top of the chat screen. Compare it with your friend's — if they match, you're really using the same code.

## Features

- **Text + images** up to 5 MB, all encrypted in the browser before being sent.
- **Automatic reconnect** when the connection drops mid-chat (can be switched off), plus a manual "Reconnect" button that rejoins the same room without reloading the page — the on-screen history survives.
- **Privacy, Terms, and Security pages** inside the app, written plainly: what is stored (nothing), what the hosting provider can still see (your IP address), and where the protection ends.
- **Server-side limits**: max 2 people per room, caps on total connections and message rate, standard security headers, and WebSocket connections from other websites are refused.
- **Installable as a PWA** with a generic notes-style icon — deliberately not chat-looking.

## Why it needs no database

When you enter a code, your browser derives two things from it:

- **The room id** — derived by the same PBKDF2 process (not a fast hash), this is the only thing sent to the server, just to pair up the two browsers using the same code. A room holds at most 2 people. Because the derivation is expensive to compute, the room id can't be used to grind through possible codes offline.
- **The encryption key** (PBKDF2 + AES-GCM 256-bit) — derived together with the room id in a single PBKDF2 run, and it never leaves the browser. Every message and image is encrypted in the sender's browser first, and only opened again in the recipient's.

The relay server in the middle only forwards the resulting random-looking encrypted text from RAM. It writes nothing to disk, logs no message contents, and never queues anything: if your friend is offline, your message is discarded immediately and you're told so. Chat history exists only in the memory of the open page — refresh the page and it's gone.

## The limits, stated plainly

- **If your friend is offline, the message is gone.** That's a chosen consequence, not a bug. There is no "it'll send when they're back".
- **Once a session ends, it can't be reopened.** No backups, no recovery.
- **Bisik is only as strong as its code.** A short or guessable code (a birthday, "secret123") can be tried by others. Use the built-in random code or a long custom one.
- **No forward secrecy yet.** The same code always derives the same key, so recorded ciphertext plus a later-leaked code would open that recording. Bisik itself stores nothing, which limits the risk — and the [Security page](https://bisik.ednasalam.com/security.html) spells it out. Use a fresh code per conversation.
- Bisik protects messages in transit and on the server. It can't help if your own device is already compromised, or if the person you're talking to photographs the screen.

## Run it yourself

Needs Node.js 20+.

```bash
npm install
npm start        # http://localhost:3000
npm test         # end-to-end suite (10 checks)
```

The test suite uses the exact same crypto module the browser uses, against a real server: same code can chat, only ciphertext crosses the server, a different code receives nothing, an offline recipient's message is dropped, reconnect works after a hard drop, a 1 MB image arrives intact, message flooding is cut at the cap, and connections from other websites are refused.

This single Node process serves the app files and the WebSocket relay together, so deployment only needs one place that can run a long-lived Node process (a VPS, Fly.io, Render, …). The instance at https://bisik.ednasalam.com runs on Render; `render.yaml` in this repo is its configuration. In production, run it behind HTTPS — WebCrypto and PWAs only work in secure contexts (HTTPS or localhost).

## What's in the repo

- `server.js` — the static server + WebSocket relay. Deliberately small; please read it end-to-end before trusting it.
- `public/` — the web app (plain HTML/CSS/JS, no framework, no build step), including `crypto.js` (all the encryption, shared by the app and the tests) and the `privacy.html`, `terms.html`, `security.html` pages.
- `test/e2e.mjs` — the end-to-end tests against a real server.

## License

MIT
