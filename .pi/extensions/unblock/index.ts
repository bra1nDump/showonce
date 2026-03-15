import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { connectScreenpipe } from "./screenpipe.ts";

const DEFAULT_PORT = 3838;
const extDir = path.dirname(new URL(import.meta.url).pathname);

// --- .env.dev loader ---
function loadEnv() {
  try {
    const content = fs.readFileSync(path.join(extDir, ".env.dev"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

// --- Prompt loader ---
function loadPrompts(): { core: string; voice: string; pi: string } {
  const promptsDir = path.join(extDir, "prompts");
  const read = (name: string) => {
    try {
      return fs.readFileSync(path.join(promptsDir, name), "utf-8");
    } catch {
      return "";
    }
  };
  return { core: read("core.md"), voice: read("voice.md"), pi: read("pi.md") };
}

// --- File logger ---
let logStream: fs.WriteStream | null = null;

function initLog() {
  const logsDir = path.join(extDir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logPath = path.join(logsDir, `${ts}.log`);
  logStream = fs.createWriteStream(logPath, { flags: "a" });
  return logPath;
}

function log(msg: string) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  logStream?.write(line);
}

// --- Extension ---

export default function (pi: ExtensionAPI) {
  loadEnv();
  const logPath = initLog();

  const PORT = parseInt(process.env.UNBLOCK_PORT || String(DEFAULT_PORT));
  const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || "";
  const prompts = loadPrompts();

  let server: http.Server | null = null;
  let wss: WebSocketServer | null = null;
  let browserSocket: WebSocket | null = null;
  let screenpipeHandle: { close: () => void } | null = null;

  // Status tracking
  let screenpipeStatus: "connected" | "disconnected" | "reconnecting" =
    "disconnected";
  let voiceStatus: "ready" | "connected" | "disconnected" = "disconnected";
  let lastScreenSnapshot = "";
  let statusCtx: any = null;

  function updateStatus() {
    if (!statusCtx) return;
    const voice = AGENT_ID ? `voice:${voiceStatus}` : "voice:off";
    const screen = `screen:${screenpipeStatus}`;
    const snapshot = lastScreenSnapshot ? ` | ${lastScreenSnapshot}` : "";
    statusCtx.ui.setStatus("unblock", `${voice} | ${screen}${snapshot}`);
  }

  // --- relay_to_voice tool ---

  pi.registerTool({
    name: "relay_to_voice",
    label: "Relay to Voice",
    description:
      "Send updates to the user via the voice agent. " +
      "Send all meaningful transitions relevant to the declared workflow we are optimizing. Each page transitoin / each meaningful action the user takes on their compouter thats relevant to the workflow",
    parameters: Type.Object({
      message: Type.String({
        description: "The message to notify the voice agent",
      }),
    }),
    async execute(toolCallId, params) {
      const { message } = params;
      log(`[relay_to_voice] ${message}`);

      if (browserSocket?.readyState === WebSocket.OPEN) {
        browserSocket.send(
          JSON.stringify({ type: "relay_to_voice", text: message })
        );
        return {
          content: [
            { type: "text" as const, text: "Relayed to voice agent." },
          ],
          details: {},
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: "Voice agent not connected. Message not delivered.",
            },
          ],
          details: {},
        };
      }
    },
  });

  // --- Pi system prompt injection ---

  pi.on("before_agent_start", async (event) => {
    // Append pi-specific prompts to the system prompt
    const extra = [prompts.core, prompts.pi].filter(Boolean).join("\n\n");
    if (extra) {
      return { systemPrompt: event.systemPrompt + "\n\n" + extra };
    }
  });

  // --- Startup ---

  pi.on("session_start", async (_event, ctx) => {
    statusCtx = ctx;
    log(`[startup] agent_id=${AGENT_ID || "(none)"} port=${PORT}`);
    log(`[startup] log file: ${logPath}`);
    updateStatus();

    if (!AGENT_ID) {
      log("[startup] ELEVENLABS_AGENT_ID not set, voice disabled");
    } else {
      startServer(ctx);
    }

    startScreenpipe();
  });

  pi.on("session_shutdown", async () => {
    log("[shutdown]");
    screenpipeHandle?.close();
    browserSocket?.close();
    wss?.close();
    server?.close();
    logStream?.end();
  });

  pi.registerShortcut("ctrl+shift+m", {
    description: "Open voice bridge in browser",
    handler: async () => openBrowser(),
  });

  // --- HTTP + WebSocket server ---

  function startServer(ctx: any) {
    const widgetPath = path.join(extDir, "widget.html");

    server = http.createServer((req, res) => {
      // Serve widget page
      if (
        req.method === "GET" &&
        (req.url === "/" || req.url?.startsWith("/?"))
      ) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(widgetPath, "utf-8"));
        return;
      }

      // Config endpoint — widget fetches agentId + prompt
      if (req.method === "GET" && req.url === "/config") {
        const voicePrompt = [prompts.core, prompts.voice]
          .filter(Boolean)
          .join("\n\n");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ agentId: AGENT_ID, systemPrompt: voicePrompt }));
        return;
      }

      res.writeHead(404);
      res.end("not found");
    });

    // WebSocket
    wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (req, socket, head) => {
      if (req.url === "/ws") {
        wss!.handleUpgrade(req, socket, head, (ws) => {
          wss!.emit("connection", ws, req);
        });
      } else {
        socket.destroy();
      }
    });

    wss.on("connection", (ws) => {
      browserSocket = ws;
      voiceStatus = "connected";
      updateStatus();
      log("[ws] browser connected");

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          log(`[ws] received: ${JSON.stringify(msg).slice(0, 200)}`);

          if (msg.type === "send_to_pi" && msg.message) {
            handleSendToPi(msg.message, ctx);
          } else if (msg.type === "voice_status") {
            voiceStatus = msg.status === "connected" ? "connected" : "disconnected";
            updateStatus();
            log(`[voice] status changed: ${voiceStatus}`);
          }
        } catch {
          log(`[ws] bad message: ${raw.toString().slice(0, 100)}`);
        }
      });

      ws.on("close", () => {
        if (browserSocket === ws) {
          browserSocket = null;
          voiceStatus = "disconnected";
          updateStatus();
          log("[ws] browser disconnected");
        }
      });
    });

    server.listen(PORT, () => {
      voiceStatus = "ready";
      updateStatus();
      log(`[server] listening on :${PORT}`);
      openBrowser();
    });
  }

  function openBrowser() {
    // Widget fetches config from /config, no need for URL params
    const url = `http://localhost:${PORT}/`;
    pi.exec("open", [url]).catch(() => {});
  }

  // --- send_to_pi handler (fire & forget from voice side) ---

  function handleSendToPi(message: string, ctx: any) {
    if (!message.trim()) return;

    log(`[voice->pi] "${message}"`);

    if (ctx.isIdle()) {
      pi.sendUserMessage(message);
    } else {
      pi.sendUserMessage(message, { deliverAs: "steer" });
    }
    // No waiting, no response collection. Fire and forget.
  }

  // --- Screenpipe ---

  function startScreenpipe() {
    screenpipeHandle = connectScreenpipe({
      log,
      onStatus: (status) => {
        screenpipeStatus = status;
        updateStatus();
      },
      onFlush: (events) => {
        const lines = events.map((e) => `[screen] ${e.summary}`).join("\n");
        const now = new Date();
        const time = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const types = [...new Set(events.map((e) => e.type))];
        lastScreenSnapshot = `snap: ${events.length} events @ ${time} (${types.join(", ")})`;
        updateStatus();
        log(`[screenpipe->pi] flushing ${events.length} events`);

        // Full data goes to the agent, but display is suppressed in terminal —
        // status bar shows the compact summary instead
        pi.sendMessage(
          {
            customType: "screen-events",
            content: lines,
            display: false,
          },
          { deliverAs: "followUp", triggerTurn: true } as any
        );
      },
    });
  }
}
