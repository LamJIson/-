// Loon HTTP Response
// 匹配规则：^https?:\/\/(?:music\.youtube\.com|youtubei\.googleapis\.com)\/youtubei\/v1\/(?:browse|get_panel)(?:\?|$)
// requires-body = true
// timeout = 30

function getArg(name, fallback = "") {
  try {
    if (typeof $argument === "string" && $argument) {
      // 支持 argument=[{a},{b}] 和 key=value&key2=value2 两种格式
      if ($argument.startsWith("[")) {
        // Loon argument 数组形式，按顺序映射
        const args = JSON.parse($argument.replace(/(\w+)/g, '"$1"').replace(/""/g, '"'));
        const map = {
          lyrics_translation: args[0],
          subtitle_target_language: args[1],
          subtitle_source_language: args[2],
          subtitle_position: args[3],
          show_only_auto_translation: args[4],
          subtitle_diagnostics: args[5],
          subtitle_cache_size: args[6],
          translation_attempts: args[7]
        };
        if (map[name] !== undefined && map[name] !== "") return String(map[name]);
      } else {
        const map = Object.fromEntries(
          $argument.split("&").map(s => {
            const i = s.indexOf("=");
            return i < 0
              ? [decodeURIComponent(s), ""]
              : [decodeURIComponent(s.slice(0, i)), decodeURIComponent(s.slice(i + 1))];
          })
        );
        if (map[name] !== undefined && map[name] !== "") return String(map[name]);
      }
    }
  } catch (_) {}
  return fallback;
}

const Store = {
  getString(k) { return $persistentStore.read(k) || ""; },
  set(k, v) { $persistentStore.write(String(v), k); },
  delete(k) { $persistentStore.write("", k); }
};

function httpRequest(opt) {
  return new Promise((resolve, reject) => {
    const method = (opt.method || "GET").toUpperCase();
    const headers = opt.headers || {};
    $httpClient[method.toLowerCase()](
      { url: opt.url, headers, body: opt.body, timeout: Math.max(1, Math.floor((opt.timeout || 8000) / 1000)) },
      (err, resp, body) => {
        if (err) return reject(err);
        resolve({ status: resp.status, headers: resp.headers || {}, body: body || "" });
      }
    );
  });
}

function log(stage, detail) {
  if (String(getArg("subtitle_diagnostics", "true")) !== "true") return;
  console.log(`[YT-Music] ${stage} ${detail}`);
}

/******************** 翻译核心 ********************/
var total = 0, active = 0, waiting = [];
async function dualFetch(request) {
  if (++total > 16) throw Error("DualSubs request budget exceeded");
  if (active >= 4) await new Promise(r => waiting.push(r));
  else active++;
  try {
    const response = await httpRequest({
      url: request.url,
      method: request.method || "GET",
      headers: request.headers || {},
      body: request.body,
      timeout: 8000
    });
    if (response.status < 200 || response.status >= 300) throw Error("DualSubs HTTP " + response.status);
    return response;
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

async function googleRows(rows, sourceLang, targetLang) {
  sourceLang = (sourceLang || "auto").toLowerCase();
  targetLang = (targetLang || "zh-CN").toLowerCase();
  if (["zh", "zh-hans"].includes(targetLang)) targetLang = "zh-CN";
  if (["zh-hant", "zh-tw", "zh-hk"].includes(targetLang)) targetLang = "zh-TW";

  const sep = "\r";
  const maxEncoded = 14000;
  const chunks = [];
  let current = [], currentEncoded = 0;

  function push() {
    if (current.length) {
      chunks.push({ rows: current.slice(), offset: 0 });
      current = [];
      currentEncoded = 0;
    }
  }

  for (const row of rows) {
    const cost = encodeURIComponent(String(row ?? "")).length + (current.length ? encodeURIComponent(sep).length : 0);
    if (current.length && (currentEncoded + cost > maxEncoded || current.length >= 120)) push();
    current.push(String(row ?? ""));
    currentEncoded += cost;
  }
  push();

  let offset = 0;
  for (const c of chunks) {
    c.offset = offset;
    offset += c.rows.length;
  }

  const out = new Array(rows.length);
  const attempts = Math.max(1, Math.min(4, Number(getArg("translation_attempts", "4")) || 1));

  async function translateChunk(chunk) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&q=${encodeURIComponent(chunk.rows.join(sep))}`;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await dualFetch({ url, method: "GET", headers: { accept: "application/json" } });
        const data = JSON.parse(res.body);
        if (!Array.isArray(data) || !Array.isArray(data[0])) throw Error("shape");
        let translated = "";
        for (const item of data[0]) if (Array.isArray(item) && item[0]) translated += item[0];
        let parts = translated.split(/\r\n?|\n/);
        if (parts.length !== chunk.rows.length) {
          parts = chunk.rows.length === 1 ? [translated] : translated.split(/\n+/);
        }
        return chunk.rows.map((_, idx) => String(parts[idx] || "").trim());
      } catch (e) {
        if (i === attempts - 1) return null;
      }
    }
    return null;
  }

  for (let i = 0; i < chunks.length; i += 4) {
    const batch = chunks.slice(i, i + 4);
    const results = await Promise.all(batch.map(translateChunk));
    for (let b = 0; b < results.length; b++) {
      if (!results[b]) return null;
      const chunk = batch[b];
      for (let r = 0; r < chunk.rows.length; r++) {
        out[chunk.offset + r] = results[b][r] || "";
      }
    }
  }
  return out;
}

/******************** 主逻辑 ********************/
async function processMusic() {
  const enable = String(getArg("lyrics_translation", "true")).toLowerCase();
  if (!["true", "1", "on"].includes(enable)) return $done({});

  if (Number($response.status) >= 300 || !$response.body) return $done({});

  const url = $request.url || "";
  if (!/^https?:\/\/(?:music\.youtube\.com|youtubei\.googleapis\.com)\/youtubei\/v1\/(?:browse|get_panel)(?:\?|$)/.test(url)) {
    return $done({});
  }

  const body = $response.body;
  const contentType = ($response.headers?.["Content-Type"] || $response.headers?.["content-type"] || "").toLowerCase();

  if (!/json/i.test(contentType) && !(typeof body === "string" && body.trim().startsWith("{"))) {
    log("music-result", "state=skip-non-json");
    return $done({});
  }

  let object;
  try {
    object = JSON.parse(typeof body === "string" ? body : "");
  } catch (e) {
    log("music-result", "state=json-parse-failed");
    return $done({});
  }

  const shelves = [
    ...(object?.contents?.sectionListRenderer?.contents || []),
    ...(object?.continuationContents?.musicDescriptionShelfRenderer
      ? [{ musicDescriptionShelfRenderer: object.continuationContents.musicDescriptionShelfRenderer }]
      : [])
  ];

  const slots = [];
  for (const shelf of shelves) {
    for (const run of shelf?.musicDescriptionShelfRenderer?.description?.runs || []) {
      if (typeof run.text === "string") {
        for (const line of run.text.split("\n")) {
          slots.push({ run, line: line.trim() });
        }
      }
    }
  }

  if (!slots.length) {
    log("music-result", "state=no-lyrics");
    return $done({});
  }

  log("music-rows", `rows=${slots.length}`);

  const sourceLang = getArg("subtitle_source_language", "auto");
  const targetLang = getArg("subtitle_target_language", "zh-CN");
  const position = getArg("subtitle_position", "Forward");
  const showOnly = String(getArg("show_only_auto_translation", "false")).toLowerCase() === "true";

  const rows = slots.map(s => s.line || "\u200b");
  const translated = await googleRows(rows, sourceLang, targetLang);

  if (!translated) {
    log("music-result", "state=translation-failed");
    return $done({});
  }

  function combine(source, translation) {
    if (showOnly) return translation;
    return position === "Reverse"
      ? translation + "\n  └ " + source
      : source + "\n  └ " + translation;
  }

  const byRun = new Map();
  slots.forEach((slot, i) => {
    if (!byRun.has(slot.run)) byRun.set(slot.run, []);
    byRun.get(slot.run).push(slot.line ? combine(slot.line, translated[i]) : "");
  });

  for (const [run, lines] of byRun) {
    run.text = lines.join("\n");
  }

  log("music-result", "state=translated");
  $done({ body: JSON.stringify(object) });
}

processMusic().catch(e => {
  console.log("YT Music error:", e);
  $done({});
});
