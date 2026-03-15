# Unblock: Research Notes (March 2026)

## What We're Building

A macOS-native app with a voice agent that watches what you do on screen, identifies repetitive tasks through conversation, and automates them.

**Key differentiators**: voice-first, passive screen observation, learn-by-demonstration, macOS-native.

**No product today combines all four.** The niche is open.

---

## Direct Competitors

| Product | Approach | Platform | Gap vs Unblock |
|---|---|---|---|
| **Cofia** (YC W26, cofia.ai) | Fully passive -- watches system events + network traffic, proposes automations | Unknown | No voice, no screen recording, fully passive (not collaborative) |
| **Kairos** (kairos.computer) | Record screen + explain verbally | Web-only | Not macOS-native, not interactive |
| **Simular AI** ($21.5M) | macOS-native desktop agent, neuro-symbolic | macOS | No voice, no learn-by-watching |
| **Microsoft Power Automate AI Recorder** | Screen + voice capture -> desktop flows | Windows only | Windows-only, enterprise |

### Cofia Deep Dive (closest competitor)
- Founders: Paola Martinez (Stanford, ex-Brilliant.org PM) + Moses Wayne (Duke, ex-Duolingo Sr Staff Eng, led monetization to $1B+)
- YC W26 Demo Day: March 24, 2026
- Approach: listens to system events + anonymized network traffic (NOT screen recording), mines for repeatable patterns, builds agents automatically
- Key diff from us: fully passive/autonomous vs our collaborative/voice-driven approach
- Unknown: platform, tech stack, pricing, how automations execute
- 1,586 likes on YC LinkedIn launch post

### Also Notable
- **Anthropic** acquired Vercept (cloud Mac agent) Feb 2026
- **Bardeen "Project Synthesis"** -- browser-based workflow observation + automation (established company)
- **OpenAI Operator** expanding to macOS
- **agent.exe** -- open source Claude-powered computer control (early POC)

---

## Technical Architecture

### Observation Layer: Screenpipe

**Screenpipe** (MIT, screenpi.pe) is the observation backbone. It's "AI memory for your screen" -- captures screen + audio 24/7, stores locally in SQLite, exposes REST API + MCP server.

**Why use it**: Solves the entire observation problem. Event-driven capture (5-10% CPU), accessibility-first with OCR fallback, audio transcription, 50+ REST endpoints on localhost:3030, JS SDK, MCP server.

**Fully self-hostable**: `npx screenpipe@latest record` runs everything locally for free. Paid tiers ($400 app / $39/mo Pro) are for convenience and cloud sync only.

**Does NOT have**: Voice agent, interactive AI, proactive suggestions. It's eyes and ears only.

**Key API endpoints**:
- `GET /search` -- full-text search across OCR, audio, accessibility, input events
- `GET /elements` -- UI elements from accessibility tree
- `GET /frames/:id/context` -- accessibility tree + text + URLs for a frame
- `GET /activity-summary` -- lightweight activity overview
- `GET /ws/events` -- WebSocket event stream (real-time)
- Pipe system for scheduled AI agents against captured data

### Automation Driver (Execution)

Four tiers, use in order:
1. **AppleScript/JXA** -- scriptable apps, highest reliability
2. **Accessibility API** (mcp-server-macos-use) -- interact by label
3. **Anthropic Computer Use API** -- vision-based, universal, expensive
4. **Raw mouse/keyboard** (cliclick) -- last resort, fragile

### Voice Layer

OpenClaw (MIT, TypeScript) has voice (Whisper STT), skill/plugin system, macOS TCC handling. Use as conversation frontend, write custom "unblock" Skill for observation + automation.

### Prefix Testing (real-time feel)

While user demonstrates step N+1, run steps 1..N in background. LLM judges success. Present full automation only when prefixes pass consistently.

---

## Market Context

- Gartner: 40% of enterprise apps will embed AI agents by 2026
- AI agent sector projected $100B+
- RPA market ~$28B by 2026
- OSWorld benchmark: human-level (72.4%) crossed by GPT-5.4 (75%), Agent S3 (72.6%), Claude Sonnet 4.6 (72.5%)
- 22+ agentic AI companies raised $1.1B+ in 2025

## Key Risks
- Simular well-funded, macOS-native, shipping
- OpenAI expanding Operator to macOS
- Apple could ship something at WWDC
- Reliability ceiling: best agents complete 25-40% of complex workflows
