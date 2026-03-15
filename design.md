# Showonce: Design Document

## What

A system that helps users identify and automate repetitive tasks. Two agents work together: a **voice agent** (interviewer) and a **pi agent** (workflow builder). The voice agent keeps the user talking to extract what the task is. The pi agent watches the screen, builds a workflow definition, and tries to replay it.

## Architecture

```
                 voice agent                    pi agent
                 (interviewer)                  (builder)
                      │                              │
user speaks ─────────►│                              │
                      │                              │
                      ├── send_to_pi ───────────────►│
                      │   (fire & forget)             │
                      │                              │◄── screenpipe events
                      │                              │    (batched, pushed)
                      │                              │
                      │                              ├── builds workflow
                      │                              ├── replays workflow
                      │                              │
                      │◄── relay_to_voice ───────────┘
                      │    (proactive, on meaningful transitions)
                      │
user hears ◄──────────┘
user sees TUI ───────────────────────────────────────► pi agent
```

```
Browser tab (localhost:PORT)         Terminal
┌─────────────────────────┐         ┌──────────────────────┐
│ 11labs VoiceConversation │         │ pi TUI               │
│ mic ──► STT ──► agent   │         │                      │
│ speaker ◄── TTS ◄─┘     │         │ messages, tool calls │
│                         │         │ editor (still works)  │
│ clientTools: {          │  WS     │                      │
│   send_to_pi ──────────────────►  │ tools: {             │
│ }                       │         │   relay_to_voice     │
│                         │  WS     │ }                    │
│ sendUserMessage ◄─────────────────│                      │
└─────────────────────────┘         └──────────────────────┘
                                          ▲
                                   screenpipe HTTP poll
                                   (every 5s, 3 streams)
```

| Piece | Owns |
|---|---|
| **Voice agent (11labs)** | Mic, speaker, STT, TTS. Interviewer role — keeps user talking, extracts task details. Sends findings to pi via `send_to_pi` client tool (fire & forget). Uses `skip_turn` (native 11labs tool) to stay silent during demonstrations. |
| **Pi agent** | Screen observation (screenpipe events pushed in), workflow building, replay/verification. Has `relay_to_voice` tool to proactively send meaningful transitions back to voice agent. Fully visible in TUI. |
| **Extension** | HTTP+WS server, screenpipe HTTP poller, batching, bridging. Registers `relay_to_voice` as a custom pi tool. No LLM calls of its own. |
| **Browser page** | Minimal HTML. Embeds 11labs widget, connects WS to extension, wires client tool. |

## Two inputs drive progress

Pi needs both signals to make progress on an automation:
1. **User intent** — what the user says they want automated (via voice → send_to_pi)
2. **Observed behavior** — what the user actually does on screen (via screenpipe)

Pi correlates these two sources and only acts when they align around a declared workflow.

## Prompts

```
prompts/
  core.md    shared context: two-agent system, two-input model (intent + behavior),
             screen events include accessibility tree, goals

  voice.md   voice agent role:
             - interviewer, keep user talking to extract task
             - send_to_pi (fire & forget) to forward findings
             - skip_turn aggressively during demonstrations — default to silence
             - weave [PI] messages into conversation naturally
             - don't bombard with questions

  pi.md      pi agent role:
             - receives interview findings AND screenpipe events (incl. accessibility tree)
             - correlate what user says with what they do on screen
             - relay_to_voice proactively on meaningful transitions:
               page switches, completing steps, spotting key UI elements
             - build workflow, replay, report
             - do NOT relay routine tool output
```

## Control Flow

### Startup

```
pi starts, loads .pi/extensions/unblock/index.ts

session_start:
  1. load .env.dev (ELEVENLABS_AGENT_ID, UNBLOCK_PORT)
  2. read prompts from prompts/ directory
  3. start HTTP + WebSocket server on :PORT
  4. start screenpipe HTTP poller (polls localhost:3030 every 5s)
  5. register relay_to_voice tool on pi
  6. open browser to localhost:PORT

browser page loads:
  7. fetch /config from extension (gets agentId, voice prompt)
  8. VoiceConversation.startSession({
       agentId, clientTools: { send_to_pi }, overrides: { prompt }
     })
```

### Voice → Pi (fire & forget)

```
user speaks
  → 11labs STT → agent LLM (interviewer)
  → agent calls send_to_pi({ message: "user wants to automate invoice copying" })
  → client tool returns IMMEDIATELY: "sent"
  → agent continues talking: "got it — tell me more about that process"
  → browser sends WS: { type: "send_to_pi", message: "..." }
  → extension:
      if idle:  pi.sendUserMessage(message)
      if busy:  pi.sendUserMessage(message, { deliverAs: "steer" })
```

### Pi → Voice (proactive, via tool)

```
pi observes a meaningful transition relevant to the declared workflow
  → pi calls relay_to_voice("You just opened the vehicle detail page on Manheim")
  → extension handles tool call:
      sends WS: { type: "relay_to_voice", text: "..." }
  → browser calls conversation.sendUserMessage("[PI] ...")
  → voice agent weaves it into conversation naturally
```

### Screen → Pi (HTTP poll, 3 streams)

```
Screenpipe exposes 3 content types via its HTTP search API:

  ocr:           ~every 2-3s. app_name, window_name, browser_url,
                 screenshot path, full OCR text of screen.
  input:         keyboard text chunks, mouse clicks (x,y + app + window),
                 clipboard events, key codes with modifiers.
  accessibility: full UI element tree (buttons, fields, menus, labels).
                 Diffed — only sent when tree changes.

Extension polls localhost:3030/search every 5s for each content type.
Uses start_time filter — each poll gets events since the last poll.
Detects: app switches, window/tab changes, URL navigation,
         typed text, clicks, clipboard activity, UI structure changes.

Batches events into a buffer:
  flush after 3s of no new events, OR 10s max

on flush:
  → pi.sendMessage({
       customType: "screen-events",
       content: "[screen] App switch: Chrome → Manheim\n[screen] UI tree [Chrome]: ...",
       display: false  // hidden in TUI, status bar shows compact summary
     }, { deliverAs: "followUp", triggerTurn: true })
  → status bar: "snap: 5 events @ 14:32:05 (app_switch, accessibility_tree)"
  → if pi is idle: triggers a turn (pi can react)
  → if pi is busy: queued, delivered when pi finishes
```

### Interrupt

```
user speaks while pi is working
  → voice agent calls send_to_pi with new message (fire & forget)
  → extension: pi.sendUserMessage(newText, { deliverAs: "steer" })
  → pi drops current work, processes new instruction
```

## File Structure

```
showonce/
├── design.md             # this file
├── research.md           # competitive landscape
├── workflows/            # example captured workflows
├── .pi/extensions/unblock/
│   ├── index.ts          # extension: HTTP+WS server, relay_to_voice tool, screenpipe batching
│   ├── widget.html       # 11labs widget + WS bridge
│   ├── screenpipe.ts     # screenpipe HTTP poller + event diffing + batching
│   ├── prompts/
│   │   ├── core.md       # shared context
│   │   ├── voice.md      # interviewer role
│   │   └── pi.md         # builder role
│   ├── logs/             # debug logs (gitignored)
│   ├── .env.dev          # ELEVENLABS_AGENT_ID (gitignored)
│   ├── .env.dev.example  # template
│   └── package.json      # deps: ws
```

## Configuration

`.env.dev` in extension directory:
```
ELEVENLABS_AGENT_ID=agent_xxx
UNBLOCK_PORT=3838
```

Screenpipe assumed running on localhost:3030.

## Why client tools, not server tools

Server tools execute on 11labs cloud — they can't reach localhost. Client tools execute in the browser JS and can call localhost freely. No tunnels needed.

## Next: Workflow summarizer agent

The accessibility tree is now polled and sent to pi alongside OCR + input events. A possible next step is a separate non-interactive summarizer agent that condenses a 5-minute rolling window of all 3 streams into a structured workflow summary, replacing raw events with higher-level step descriptions.

## Debugging

- Extension logs to `logs/<datetime>.log` with timestamped entries
- All WS messages, tool calls, screenpipe events, errors logged
- Status bar shows: `voice:<status> | screen:<status> | snap: N events @ HH:MM:SS`
- Browser page shows real-time log of all messages flowing through
- TUI stays fully interactive — can type commands, inspect, use /tree
