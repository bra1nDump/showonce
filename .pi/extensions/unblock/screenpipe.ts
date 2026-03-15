import http from "node:http";

/**
 * Screenpipe HTTP poller.
 *
 * Polls 3 content types from screenpipe's /search API every 5s:
 *   - ocr:   app_name, window_name, browser_url, OCR text, screenshot path
 *   - input: keyboard text, mouse clicks (x,y), clipboard, key codes
 *   - accessibility: full UI element tree (buttons, fields, menus, labels)
 *
 * Uses start_time filter — each poll asks for events since the last poll.
 * No ID tracking, no limit hacks. Just "give me everything since T."
 *
 * Detects app switches, window/tab changes, URL navigation,
 * typed text, clicks, clipboard activity, and UI structure changes.
 * Batches events and flushes to pi after quiet period or max interval.
 *
 * The accessibility tree is sent on context switches (app/window change)
 * so pi knows exactly what UI elements are available for automation.
 */

export type ScreenEvent = {
  type: string;
  summary: string;
  timestamp: string;
};

export type StatusHandler = (
  status: "connected" | "disconnected" | "reconnecting"
) => void;

export function connectScreenpipe(opts: {
  onFlush: (events: ScreenEvent[]) => void;
  onStatus: StatusHandler;
  baseUrl?: string;
  pollIntervalMs?: number;
  quietMs?: number;
  maxMs?: number;
  log?: (msg: string) => void;
}): { close: () => void } {
  const {
    onFlush,
    onStatus,
    baseUrl = "http://localhost:3030",
    pollIntervalMs = 5000,
    quietMs = 3000,
    maxMs = 10000,
    log = () => {},
  } = opts;

  let closed = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let connected = false;

  // Batching state
  let buffer: ScreenEvent[] = [];
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;

  // Last poll timestamp — everything since this time is new
  let lastPollTime = new Date().toISOString();

  // Track state for diffing (app switches etc)
  let lastApp = "";
  let lastWindow = "";
  let lastBrowserUrl = "";
  let lastAccessibilityTree = "";

  function flush() {
    if (quietTimer) clearTimeout(quietTimer);
    if (maxTimer) clearTimeout(maxTimer);
    quietTimer = null;
    maxTimer = null;

    if (buffer.length > 0) {
      const batch = buffer;
      buffer = [];
      log(`[screenpipe] flushing ${batch.length} events`);
      onFlush(batch);
    }
  }

  function addEvent(event: ScreenEvent) {
    buffer.push(event);

    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = setTimeout(flush, quietMs);

    if (!maxTimer) {
      maxTimer = setTimeout(flush, maxMs);
    }
  }

  // --- HTTP fetch helper ---

  function fetchJson(urlPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      http
        .get(`${baseUrl}${urlPath}`, (res) => {
          let body = "";
          res.on("data", (chunk: string) => (body += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error(`bad json from ${urlPath}`));
            }
          });
        })
        .on("error", reject);
    });
  }

  // --- OCR stream: app switches, window changes, URL navigation ---

  async function pollOcr(since: string) {
    const data = await fetchJson(
      `/search?content_type=ocr&start_time=${encodeURIComponent(since)}`
    );
    const items: any[] = (data?.data || []).reverse(); // oldest first

    for (const item of items) {
      const c = item.content;
      const app = c.app_name || "";
      const window = c.window_name || "";
      const url = c.browser_url || "";
      const ts = c.timestamp || new Date().toISOString();

      if (!app) continue;

      // App switch
      if (app !== lastApp && lastApp) {
        addEvent({
          type: "app_switch",
          summary: `App switch: ${lastApp} → ${app}${window ? ` — "${window.slice(0, 80)}"` : ""}`,
          timestamp: ts,
        });
      }
      // Window/tab change within same app
      else if (window !== lastWindow && lastWindow) {
        addEvent({
          type: "window_change",
          summary: `Tab/window in ${app}: "${window.slice(0, 80)}"`,
          timestamp: ts,
        });
      }

      // URL change in browser
      if (url && url !== lastBrowserUrl && lastBrowserUrl) {
        addEvent({
          type: "url_change",
          summary: `URL: ${url.slice(0, 150)}`,
          timestamp: ts,
        });
      }

      lastApp = app;
      lastWindow = window;
      if (url) lastBrowserUrl = url;
    }
  }

  // --- Accessibility stream: full UI element tree ---

  async function pollAccessibility(since: string) {
    const data = await fetchJson(
      `/search?content_type=accessibility&start_time=${encodeURIComponent(since)}`
    );
    const items: any[] = (data?.data || []).reverse(); // oldest first

    for (const item of items) {
      const c = item.content;
      const tree = c.text || "";
      const app = c.app_name || lastApp;
      const ts = c.timestamp || new Date().toISOString();

      if (!tree || tree === lastAccessibilityTree) continue;
      lastAccessibilityTree = tree;

      // Truncate to keep context manageable — full trees can be huge
      const truncated = tree.length > 4000 ? tree.slice(0, 4000) + "\n... (truncated)" : tree;

      addEvent({
        type: "accessibility_tree",
        summary: `UI tree [${app}]:\n${truncated}`,
        timestamp: ts,
      });
    }
  }

  // --- Input stream: keyboard text, clicks, clipboard ---

  async function pollInput(since: string) {
    const data = await fetchJson(
      `/search?content_type=input&start_time=${encodeURIComponent(since)}`
    );
    const items: any[] = (data?.data || []).reverse(); // oldest first

    for (const item of items) {
      const c = item.content;
      const eventType = c.event_type || "";
      const ts = c.timestamp || new Date().toISOString();
      const app = c.app_name || lastApp;
      const win = c.window_title || "";

      if (eventType === "text" && c.text_content) {
        const text = c.text_content.replace(/\n/g, "↵").slice(0, 200);
        addEvent({
          type: "typed_text",
          summary: `Typed: "${text}"`,
          timestamp: ts,
        });
      } else if (eventType === "click" && c.x != null && c.y != null) {
        addEvent({
          type: "click",
          summary: `Click at (${c.x},${c.y}) in ${app}${win ? ` — "${win.slice(0, 50)}"` : ""}`,
          timestamp: ts,
        });
      } else if (eventType === "clipboard" && c.text_content) {
        addEvent({
          type: "clipboard",
          summary: `Clipboard: "${c.text_content.slice(0, 150)}"`,
          timestamp: ts,
        });
      } else if (eventType === "key" && c.key_code) {
        const mods = c.modifiers ? ` +${c.modifiers}` : "";
        addEvent({
          type: "key",
          summary: `Key: ${c.key_code}${mods}`,
          timestamp: ts,
        });
      }
    }
  }

  // --- Poll loop ---

  async function poll() {
    if (closed) return;

    const since = lastPollTime;
    lastPollTime = new Date().toISOString();

    try {
      await Promise.all([pollOcr(since), pollInput(since), pollAccessibility(since)]);

      if (!connected) {
        connected = true;
        onStatus("connected");
        log("[screenpipe] polling connected");
      }
    } catch (err: any) {
      if (connected) {
        connected = false;
        onStatus("reconnecting");
      }
      log(`[screenpipe] poll error: ${err.message}`);
    }

    if (!closed) {
      pollTimer = setTimeout(poll, pollIntervalMs);
    }
  }

  // --- Start ---

  onStatus("disconnected");
  log("[screenpipe] starting HTTP poll (ocr + input + accessibility, every 5s)");

  // Seed lastApp/lastWindow from current screen so first diff is accurate
  fetchJson("/search?content_type=ocr&limit=1&offset=0")
    .then((data) => {
      const items = data?.data || [];
      if (items.length > 0) {
        const c = items[0].content;
        lastApp = c.app_name || "";
        lastWindow = c.window_name || "";
        lastBrowserUrl = c.browser_url || "";
        log(`[screenpipe] seeded: app=${lastApp}, window=${lastWindow.slice(0, 50)}`);
      }
      connected = true;
      onStatus("connected");
      poll();
    })
    .catch((err) => {
      log(`[screenpipe] seed failed: ${err.message}, starting poll anyway`);
      poll();
    });

  return {
    close() {
      closed = true;
      flush();
      if (pollTimer) clearTimeout(pollTimer);
      if (quietTimer) clearTimeout(quietTimer);
      if (maxTimer) clearTimeout(maxTimer);
    },
  };
}
