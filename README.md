# Parley

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Parley Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>Record the meeting. Then hand it to the AI you already use.</strong>
</p>

> **This is Jesse Anglen's fork** of [Parley](https://github.com/pathorsAI/parley): a meeting teleprompter. Before the call, notes become a checklist. During the call, items tick off in whatever order they get covered, and a small always-on-top window shows what's left. It builds the open-source edition only and does not install upstream releases. Setup is in [This fork](#this-fork).

<p align="center">
  <a href="https://github.com/pathorsAI/parley/releases/latest"><img src="https://img.shields.io/github/v/release/pathorsAI/parley?label=release&color=2ea44f" alt="Latest release"></a>
  <a href="https://github.com/pathorsAI/parley/actions/workflows/release.yml"><img src="https://github.com/pathorsAI/parley/actions/workflows/release.yml/badge.svg" alt="Release Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License"></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/built%20with-Tauri-blue.svg?style=flat&logo=tauri" alt="Tauri"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg" alt="Platform: macOS and Windows">
</p>

<p align="center">
  <img src="website/assets/shots/desktop-library-en.jpg" alt="Parley on macOS: All recordings, grouped by day, with folders for Renewals, New business and Internal in the sidebar (fictional demo data)" width="900" />
</p>

Parley does four things: **record, transcribe, analyze, search**. It captures both sides of a call, gives you a speaker-labelled transcript live, writes a debrief when the meeting ends, and makes every word you have ever recorded searchable.

Then it opens all of it over a local **MCP server** — 54 tools — so Claude, Claude Code, Cursor or any other MCP client can read, search, file and re-analyze your whole meeting history without a copy-paste in sight.

- 🎙️ **Both sides, live** — your mic and the meeting's system audio, transcribed and diarized as you talk.
- 📼 **A debrief that stays** — commitments, action items, findings on a timeline, and a delivery scorecard. Generated once, saved with the recording.
- 🔎 **Searchable forever** — full-text across every transcript line and every conclusion the analysis drew.
- 🔌 **Open by protocol** — anything the app can do to your library, an MCP client can do too, including owning the analysis outright.

**Local-first, bring your own keys.** Audio and transcripts go directly to the STT and LLM providers *you* configure (Claude, OpenAI, Gemini, Soniox, Deepgram, …). No Pathors proxy, no telemetry, everything stored on your machine.

**macOS and Windows, from one codebase.** Both record both sides of a call: macOS captures the other side through a Core Audio process tap, Windows through WASAPI loopback of the default output device (no permission needed).

| | macOS | Windows |
| --- | --- | --- |
| Records the other side of the call | Yes — Core Audio process tap | Yes — WASAPI loopback of the default output device |
| Records your microphone | Yes | Yes |
| Voice typing | Yes (<kbd>Option+Space</kbd>) | Yes (<kbd>Ctrl+Alt+Space</kbd>) |
| Transcription, diarization and analysis | Yes | Yes |
| Sign-in and cloud sync | Yes | Yes |
| Closing the window | Hides it; Parley stays in the Dock | Hides it; Parley stays in the notification area (tray) |

Closing the window never stops voice typing: Parley keeps running so the shortcut still works (an active meeting is ended and saved first). Bring the window back from the Dock (macOS) or by clicking the tray icon (Windows); quit with <kbd>⌘Q</kbd> on macOS, or **Quit Parley** in the tray icon's right-click menu on Windows.

There are also companion apps for [iPhone](https://apps.apple.com/app/id6795031201) and Android that record in-person meetings and sync to the same account.

---

## 📥 Install

**macOS** — download the `.dmg` from the [**Releases page**](https://github.com/pathorsAI/parley/releases/latest) or [directly](https://api.parley.tw/download?platform=macos), open it, and drag **Parley** into Applications. Builds are signed and notarized — no Gatekeeper hoops.

**Windows** — download [`Parley-setup.exe`](https://api.parley.tw/download?platform=windows) and run it. The installer is not code-signed, so SmartScreen shows an "unknown publisher" warning: click **More info**, then **Run anyway**.

Then paste your API keys in **Settings**: one STT provider for transcription, one LLM for analysis and Ask. Or sign in and use the hosted providers with no key to manage.

---

## 🎙️ During the call

<p align="center">
  <img src="website/assets/shots/desktop-live-en.jpg" alt="A meeting in progress: the live transcript split by speaker on the left, the coach feed in the middle, the agenda checklist on the right (fictional demo data)" width="820" />
</p>

Starting a meeting is one button. Parley captures both sides — your mic and the meeting's system audio — and transcribes them live, diarized as `me` / `them`, with editable speaker names.

Describe the meeting in its **context field** — who is in the room, what is at stake, what you want the analysis to watch for — and that description goes verbatim into every analysis prompt for the recording. It is also the field an MCP client writes to when it wants to re-aim the analysis.

Beside the transcript sits the **coach feed**: evaluation alerts from your own templates (negotiation risk, qualification gaps, red flags, or whatever rubric you wrote), each with a drill-down into *how to reply*, plus an agenda checklist that ticks itself off as the conversation covers it. Ask anything from the input bar and get answers grounded in the conversation so far.

---

## 📼 After the call

<p align="center">
  <img src="website/assets/shots/desktop-report-en.jpg" alt="The report after a sales call: where it landed, commitments on both sides, what is still unknown and action items, each with a timestamp (fictional demo data)" width="820" />
</p>

Stopping a meeting lands on its debrief. Any recording — just finished, pulled from history, dragged in as an audio file, or imported as a `.txt` transcript — opens in two views:

- **Report** — one scroll: the debrief with clickable timestamps, both sides' commitments, action items, and your delivery scorecard (measured pace, talk share, filler sounds).
- **Replay** — the full player: scrub to any moment and re-run the analysis *as of that point*, click through findings on the timeline, and ask anything about the call from a drawer that follows you across tabs.

Everything generates once and saves with the recording — reopen it a month later and the whole report loads instantly, no extra LLM calls. **LLM speaker re-attribution** fixes diarization drift by conversational context.

---

## 🗂️ Between calls

One customer, one folder. Every recording is filed in a folder — moved from the library, from the replay titlebar, or by an MCP client — so the calls with one customer sit together instead of scattering across a flat list. Sign in and a folder can live on the shared organization side instead of your personal one.

`search_meetings` runs full-text across everything you have recorded: every transcript line (each hit carrying a seek target) plus every brief, finding, action item and meeting context. Scope it to one folder to ask a question about one customer.

---

## 🔌 The MCP server

Parley runs a local Model Context Protocol server. Point your MCP client at it — the app has to be open — and it gets the live meeting, every saved recording, and the whole filing system:

```bash
claude mcp add --transport http parley http://127.0.0.1:3011/mcp
```

The exact endpoint, a ready-to-paste command, and a live view of what your client is doing are in **Settings → MCP Server**. 54 tools, in six groups:

| Group | What it reaches | Tools |
| --- | --- | --- |
| **The meeting happening now** | What is on screen, what has been said, the checklist beside it | `get_app_context`, `get_focused_content`, `get_transcript`, `list_todos`, `add_todo`, `check_todo`, `list_evaluations` |
| **Everything you have recorded** | Full-text search and full reads across history, on this device and your others | `search_meetings`, `list_recordings`, `get_recording`, `rename_recording`, `list_cloud_recordings`, `download_cloud_recording` |
| **The library, organized** | Personal folders, filing, bulk text import, deletion | `list_folders`, `create_folder`, `rename_folder`, `delete_folder`, `move_recording_to_folder`, `import_transcript`, `delete_recording` |
| **Your team's shared space** | The org side, with the same permissions the app enforces | `list_orgs`, `list_org_recordings`, `list_org_folders`, `create_org_folder`, `share_recording_to_org`, `move_org_recording_to_folder`, `copy_org_recording_to_personal`, `delete_org_recording` |
| **Hand over the analysis** | Writing findings, action items and the debrief back into the app | `set_recording_analysis`, `update_recording_meta`, `list_findings`, `set_findings`, `update_finding`, `upsert_eval_template`, `upsert_todo_template` |
| **How dictation spells things** | The voice-typing phrase dictionary — product names, jargon, people | `list_dictionary_phrases`, `add_dictionary_phrase`, `update_dictionary_phrase`, `delete_dictionary_phrase` |

**Letting an external AI own the analysis.** Turn off **Auto-analyze recordings** in Settings and a finished or imported recording stays unanalyzed on purpose. An agent polls `list_recordings` with `since` / the `analyzed` flag, reads the transcript, and writes its own findings, action items and brief back with `set_recording_analysis` — stamping `author` so its findings stay distinguishable from Parley's own pass. Manual regeneration still works either way.

---

## 🔒 Privacy

Conversation content is sensitive, so Parley runs straight from your machine:

- **Direct connections** — audio and transcripts go only to the providers you configure, under your own keys.
- **Local storage** — recordings, transcripts, and templates stay in your local app directory.
- **No telemetry** — nothing tracked, collected, or uploaded.

---

## 🎁 Also in the box

- **Voice typing** — system-wide push-to-talk dictation in any app, using your configured STT provider. Hold a key (default <kbd>Option+Space</kbd> on macOS, <kbd>Ctrl+Alt+Space</kbd> on Windows), speak, release — the text pastes into the frontmost app.
- **Import what you already have** — drag in an audio file, or import a pile of `.txt` transcripts (speaker labels and `[HH:MM:SS]` timestamps are auto-detected) straight into the right folder.
- **Reusable playbooks** — evaluation and checklist templates: MEDDICC, negotiation terms, interview rubrics, diligence questions, or your own.
- **Traditional Chinese** — full zh-TW UI and on-the-fly conversion of transcribed text.

---

## This fork

A pre-meeting checklist, checked off during the call, with a compact window you can glance at. The app opens in English. Traditional Chinese is still in Settings → Basic.

- **Brain dump.** Home → **Prepare checklist**. Paste a script or a bullet dump and press **Generate**. Claude Code on this Mac (`claude -p`, JSON output) turns it into short items you can edit, reorder, merge, delete, and add to. A checklist template applies from that screen and from the live checklist. Settings → To-dos can switch generation to the configured language model instead.
- **Prepared outside the app.** Drop a `.json` or `.md` file in `~/Parley/checklists`. It shows on Home. Opening it loads the title, optional time, context, and items, then moves the file to `~/Parley/checklists/applied/` so it leaves the pending list. The existing MCP `add_todo` tool still adds one item to the live meeting.
- **Jev checks items off.** While recording, each open item is one yes/no question against the transcript so far (`POST https://api.typesafe.ai/v1/systemone`, model `jev-1.14.0`). A pass runs only when new final speech has arrived, and not more often than every 15 seconds, so two highs in a row are two different transcripts. At or above **0.85** (twice in a row, by default) the item is done. Between **0.25** and that line it is marked partly covered. Those cutoffs were tuned on `jev-1.14.0`: genuinely covered items scored 0.89–0.99, a passing mention scored 0.30–0.77, and not-covered items stayed at or below 0.12. The classifier never unchecks an item and never overrides a click. Settings → To-dos can change the model id and the thresholds, or switch check-off back to the older language-model checker. The TypeSafe key is stored in the macOS keychain (or a `0600` file in the app config directory) and is sent only from the Rust side. The transcript budget keeps about 8,000 tokens of headroom under Jev's 32k-per-question limit. If a request still comes back `400 max_tokens_exceeded`, it is sent once more with half the transcript.
- **Teleprompter.** A small, resizable, always-on-top window, visible on every Space, shows the remaining items. Done items collapse. A click checks or unchecks by hand. Tauri content protection is on, so the window is hidden from many screen-sharing paths (`NSWindowSharingNone` on macOS, display affinity on Windows). Some newer capture APIs, including ScreenCaptureKit, can still record a protected window depending on the macOS version and the app doing the capture. Treat that as a courtesy, not a guarantee.
- **Open source only.** `bun run dev` and `bun run build` set `VITE_PARLEY_CLOUD=false`, so sign-in, sync, and hosted providers are compiled out. Automatic update checks are off, and the updater endpoint points at `j2wed09/parley` rather than upstream Pathors releases.

### Setup

1. **Speech-to-text.** Settings → Transcription. A Deepgram or Soniox API key is the straightforward cloud option; an on-device model works with no key.
2. **Claude Code**, for turning notes into a checklist. Install the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code), run `claude` once, and log in. The app looks for `claude` on `PATH`, and also in `/opt/homebrew/bin`, `/usr/local/bin`, and `~/.local/bin` (a Dock launch does not inherit a terminal `PATH`). Override the binary with `PARLEY_CLAUDE_BIN` if it lives somewhere else. If the CLI is missing or not logged in, Generate says so. Settings → To-dos can use the configured language model instead, which needs its own key under Settings → Provider.
3. **TypeSafe**, for live check-off. Settings → To-dos → paste the API key → **Save key**. The field clears after that; the window does not keep the key. Without a key, Jev reports that it is not set.

### Checklist files

`~/Parley/checklists/acme.json`:

```json
{
  "title": "Acme renewal",
  "meetingTime": "2026-10-29T15:00:00-07:00",
  "context": "Dana owns the account.",
  "items": ["Confirm who owns the budget", "Ask what success looks like in 90 days"]
}
```

An item may also be `{ "text": "..." }`. `meetingTime` and `context` are optional. `meetingTime` is shown as written; it is not added to a calendar.

`~/Parley/checklists/acme.md`:

```markdown
---
title: Acme renewal
meetingTime: Thursday 3pm
context: Dana owns the account.
---

- Confirm who owns the budget
- Ask what success looks like in 90 days
```

A leading `# Title` is used when front matter has no title. `-`, `*`, and `1.` lines are items. Other lines become the context when front matter did not set one.

### Tuning Jev

Thresholds live in Settings → To-dos. To see real probabilities before changing them:

```bash
TYPESAFE_API_KEY="…" bun run jev-smoke-test
```

The script (`scripts/jev-smoke-test.ts`) reads the key from the environment, sends a sample transcript and four checklist items to the pinned model (`jev-1.14.0`, the same default as the app), and prints each item's probability plus the model version that answered. It does not read a key from the repo. Do not commit a key. The app's model id is a setting (Settings → To-dos) and defaults to that pin. `jev-latest` is accepted there, but it moves when TypeSafe ships a release, so retune the thresholds before relying on it.

---

## 🛠️ Build from source

Requires **Rust** (stable), **Bun** (or Node.js), and **CMake** plus **libclang** for the on-device transcription engine (see [CONTRIBUTING.md](CONTRIBUTING.md#native-build-prerequisites)):

```bash
git clone https://github.com/j2wed09/parley.git
cd parley
bun install
bun run tauri dev
```

`bun run dev` and `bun run build` force `VITE_PARLEY_CLOUD=false`. Do not install a release built from `pathorsAI/parley` over this fork: that build would replace it and turn automatic updates back toward upstream.

Before opening a PR, `bunx tsc --noEmit` and `bunx vitest run` must both pass. See [CLAUDE.md](CLAUDE.md) for the repository conventions.

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report bugs, suggest features, and submit pull requests.

## 📄 License

Licensed under the [Apache License 2.0](LICENSE). Copyright 2026 Pathors AI.
