/**
 * YouTube Dual Subtitles (Translate) - Surge Version
 * 将外语字幕翻译为简体中文并双语显示
 *
 * [Script]
 * youtube-dual-subs = type=http-response, pattern=^https?:\/\/www\.youtube\.com\/api\/timedtext, requires-body=1, max-size=0, script-path=youtube-dual-subs.js, argument=subtitle_type=Translate&show_only_auto_translation=false
 *
 * [MITM]
 * hostname = www.youtube.com
 */

const $ = {
  request: typeof $request !== "undefined" ? $request : {},
  response: typeof $response !== "undefined" ? $response : {},
  argument: typeof $argument !== "undefined" ? $argument : "",
  done: (obj) => $done(obj)
};

if (!$response || !$response.body) {
  $.done({});
} else {
  main().catch((e) => {
    console.log("[YT DualSubs] Error: " + e);
    $.done({});
  });
}

async function main() {
  const params = parseArgument($.argument);
  const subtitleType = String(params.subtitle_type || "Translate").toLowerCase();
  if (subtitleType === "official" || subtitleType === "offical") {
    $.done({});
    return;
  }

  const showOnly = toBool(params.show_only_auto_translation, false);
  const requestUrl = $.request.url || "";
  const explicitTarget = queryParam(requestUrl, "tlang");
  let targetLang = normalizeLang(explicitTarget || storeGet("ytdual:lastTarget") || "zh-CN", "zh-CN");
  const sourceLang = normalizeLang(queryParam(requestUrl, "lang"), "auto");
  const fmt = (queryParam(requestUrl, "fmt") || queryParam(requestUrl, "format") || "").toLowerCase();

  // 源语言已是中文则跳过
  if (/^zh(?:-|$)/i.test(sourceLang)) {
    $.done({});
    return;
  }
  if (!explicitTarget && sameBaseLang(sourceLang, targetLang)) targetLang = "zh-CN";
  if (explicitTarget) storeSet("ytdual:lastTarget", targetLang);

  let body = $.response.body;
  if (body instanceof ArrayBuffer) {
    body = new TextDecoder("utf-8").decode(body);
  } else if (typeof body !== "string") {
    body = String(body || "");
  }
  if (!body) {
    $.done({});
    return;
  }

  const headers = $.response.headers || {};
  const contentType = (headers["Content-Type"] || headers["content-type"] || "").split(";")[0].toLowerCase();
  const trimmed = body.trim();
  const bodyCacheKey = responseCacheKey(body, sourceLang, targetLang, fmt, showOnly, requestUrl);

  // 缓存命中
  const cached = storeGet(bodyCacheKey);
  if (cached) {
    $.done({ body: cached });
    return;
  }

  let outText = "";
  let xmlTextMode = false;

  if (contentType.indexOf("json") >= 0 || fmt.indexOf("json") >= 0 || trimmed.charAt(0) === "{") {
    outText = await translateJson(body, sourceLang, targetLang, showOnly);
  } else if (contentType.indexOf("vtt") >= 0 || fmt.indexOf("vtt") >= 0 || /^WEBVTT/i.test(trimmed)) {
    outText = await translateVtt(body, sourceLang, targetLang, showOnly);
  } else if (contentType.indexOf("xml") >= 0 || fmt === "srv3" || fmt === "ttml" || trimmed.charAt(0) === "<") {
    xmlTextMode = true;
    outText = await translateXml(body, sourceLang, targetLang, fmt, showOnly);
  }

  if (!outText) {
    $.done({});
    return;
  }

  storeSet(bodyCacheKey, outText);
  $.done({ body: outText });
}

/* ==================== 工具函数 ==================== */

function parseArgument(arg) {
  const result = {};
  if (!arg) return result;
  String(arg).split("&").forEach((pair) => {
    const eq = pair.indexOf("=");
    if (eq < 0) return;
    const key = decodeURIComponent(pair.slice(0, eq).trim());
    const value = decodeURIComponent(pair.slice(eq + 1).trim());
    if (key) result[key] = value;
  });
  return result;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const v = String(value).toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

function queryParam(url, name) {
  const query = String(url || "").split("#")[0].split("?")[1] || "";
  const parts = query.split("&");
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf("=");
    const key = decode(eq >= 0 ? parts[i].slice(0, eq) : parts[i]);
    if (key === name) return decode(eq >= 0 ? parts[i].slice(eq + 1) : "");
  }
  return "";
}

function decode(value) {
  value = String(value == null ? "" : value).replace(/\+/g, " ");
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

function encodeQuery(value) {
  return encodeURIComponent(String(value == null ? "" : value));
}

function normalizeLang(value, fallback) {
  value = String(value || fallback || "").trim();
  if (!value || value.toLowerCase() === "und") return fallback || "auto";
  const lower = value.toLowerCase();
  if (lower === "zh" || lower === "zh-hans" || lower === "zh-cn") return "zh-CN";
  if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk") return "zh-TW";
  return value;
}

function sameBaseLang(left, right) {
  left = String(left || "").toLowerCase().split(/[-_]/)[0];
  right = String(right || "").toLowerCase().split(/[-_]/)[0];
  return !!left && left !== "auto" && left === right;
}

function storeGet(key) {
  try {
    return $persistentStore.read(key) || "";
  } catch (_) {
    return "";
  }
}

function storeSet(key, value) {
  try {
    $persistentStore.write(String(value), key);
  } catch (_) {}
}

function hashText(value) {
  value = String(value == null ? "" : value);
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function responseCacheKey(text, sourceLang, targetLang, fmt, showOnly, requestUrl) {
  return (
    "ytdualproxy:rowfix1:body:" +
    (queryParam(requestUrl, "v") || "-") +
    ":" +
    (sourceLang || "auto") +
    ":" +
    (targetLang || "zh-CN") +
    ":" +
    (fmt || "-") +
    ":" +
    showOnly +
    ":" +
    text.length +
    ":" +
    hashText(text)
  );
}

function htmlDecode(value) {
  const entities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
  return String(value == null ? "" : value).replace(
    /(&(?:lt|gt|amp|apos|quot|#(?:\d{1,7}|x[0-9a-fA-F]{1,6}));)/g,
    function (entity) {
      if (entity.charAt(1) === "#") {
        const code = entity.charAt(2) === "x" ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
        if (code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) {
          return String.fromCodePoint(code);
        }
      }
      return entities[entity] || entity;
    }
  );
}

function htmlEncode(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanCueText(value) {
  return String(value == null ? "" : value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function combine(source, translated, showOnly, xmlTextMode) {
  translated = xmlTextMode
    ? String(translated == null ? "" : translated).replace(/\s+/g, " ").trim()
    : cleanCueText(translated);
  if (!translated) return source;
  source = String(source == null ? "" : source);
  if (showOnly) return translated || source;
  return source ? source + "\n" + translated : translated;
}

function googleText(data) {
  const out = [];
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (let i = 0; i < data[0].length; i++) {
      if (Array.isArray(data[0][i]) && data[0][i][0]) out.push(data[0][i][0]);
    }
  }
  return out.join("");
}

/* ==================== 翻译核心 ==================== */

async function translateRows(rows, sourceLang, targetLang) {
  const out = new Array(rows.length);
  const sep = "\r";
  const sepCost = encodeQuery(sep).length;
  const maxChunks = 16;
  const maxEncoded = 14000;
  const chunks = [];
  let current = [];
  let currentEncoded = 0;
  const costs = new Array(rows.length);
  let totalEncoded = 0;

  for (let ti = 0; ti < rows.length; ti++) {
    costs[ti] = encodeQuery(String(rows[ti] == null ? "" : rows[ti])).length;
    if (costs[ti] > maxEncoded) return null;
    totalEncoded += costs[ti] + (ti ? sepCost : 0);
  }

  let desiredChunks = Math.max(1, Math.min(12, Math.ceil(totalEncoded / 2800)));

  function pushChunk() {
    if (!current.length) return;
    chunks.push({ offset: 0, rows: current, encoded: currentEncoded });
    current = [];
    currentEncoded = 0;
  }

  for (let ri = 0; ri < rows.length; ri++) {
    const row = String(rows[ri] == null ? "" : rows[ri]);
    let cost = costs[ri] + (current.length ? sepCost : 0);
    if (current.length && currentEncoded + cost > maxEncoded) {
      pushChunk();
      cost = costs[ri];
    }
    current.push(row);
    currentEncoded += cost;
  }
  pushChunk();

  if (chunks.length > maxChunks) return null;
  desiredChunks = Math.max(desiredChunks, chunks.length);

  while (chunks.length < desiredChunks) {
    let largest = -1;
    for (let si = 0; si < chunks.length; si++) {
      if (chunks[si].rows.length > 1 && (largest < 0 || chunks[si].encoded > chunks[largest].encoded)) {
        largest = si;
      }
    }
    if (largest < 0) break;
    const sourceRows = chunks[largest].rows;
    const splitAt = Math.max(1, Math.floor(sourceRows.length / 2));
    const leftRows = sourceRows.slice(0, splitAt);
    const rightRows = sourceRows.slice(splitAt);
    chunks.splice(
      largest,
      1,
      { offset: 0, rows: leftRows, encoded: encodeQuery(leftRows.join(sep)).length },
      { offset: 0, rows: rightRows, encoded: encodeQuery(rightRows.join(sep)).length }
    );
  }

  let offset = 0;
  for (let vi = 0; vi < chunks.length; vi++) {
    chunks[vi].offset = offset;
    offset += chunks[vi].rows.length;
  }

  function httpGet(url) {
    return new Promise((resolve, reject) => {
      $httpClient.get(
        {
          url: url,
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "identity"
          },
          timeout: 8
        },
        (error, response, data) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({ status: response.status, body: data });
        }
      );
    });
  }

  async function translateChunk(chunk) {
    const url =
      "http://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
      "&sl=" +
      encodeQuery(sourceLang || "auto") +
      "&tl=" +
      encodeQuery(targetLang || "zh-CN") +
      "&q=" +
      encodeQuery(chunk.rows.join(sep));

    let res;
    try {
      res = await httpGet(url);
    } catch (e) {
      return null;
    }
    if ((res.status || 0) < 200 || (res.status || 0) >= 300 || !res.body) return null;

    let translated;
    try {
      translated = googleText(JSON.parse(res.body));
    } catch (e) {
      return null;
    }

    let parts = translated.split(/\r\n?|\n/);
    if (parts.length !== chunk.rows.length) {
      parts = chunk.rows.length === 1 ? [translated] : translated.split(/\n+/);
    }
    const normalized = [];
    for (let j = 0; j < chunk.rows.length; j++) {
      normalized.push((parts[j] || "").trim());
    }
    return normalized;
  }

  for 
