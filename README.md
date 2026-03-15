# showonce

Show it once, never do it again.

A two-agent system that watches you perform a repetitive task on your computer and builds an automation from it.

- **Voice agent** (11labs) interviews you to understand what you're trying to automate
- **Pi agent** watches your screen via [screenpipe](https://github.com/mediar-ai/screenpipe) (OCR, input events, accessibility tree), correlates what you do with what you said, and builds a step-by-step workflow
- You demonstrate the task once while talking through it. The system captures everything and replays it.

## How it works

1. Voice agent asks what task you want automated
2. You describe it and start demonstrating on your computer
3. Pi agent silently watches — app switches, clicks, typed text, page navigation, full UI element trees
4. Pi relays observations back through the voice agent so you know it's following along
5. Once captured, pi builds a replayable workflow definition

## Setup

Runs as a [pi-coding-agent](https://github.com/nickarls/pi-coding-agent) extension.

```
cp .pi/extensions/unblock/.env.dev.example .pi/extensions/unblock/.env.dev
# add your ElevenLabs agent ID
npm install --prefix .pi/extensions/unblock
```

Requires [screenpipe](https://github.com/mediar-ai/screenpipe) running on `localhost:3030`.

## Architecture

```
User (voice) ←→ Voice Agent (11labs)
                    ↕ send_to_pi / relay_to_voice
                Pi Agent (pi-coding-agent)
                    ↑
                Screenpipe HTTP polling (OCR + input + accessibility tree)
```

See [design.md](design.md) for full architecture details.
