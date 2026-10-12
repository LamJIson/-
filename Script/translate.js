async function process(ctx) {
  if (ctx.phase !== "response" || !ctx.url || !ctx.body) return;
  function paramValue(name, fallback) {
    try {
      if (typeof Anywhere !== "undefined" && Anywhere.params) {
        var value = Anywhere.params.get(name);
        if (value !== undefined && value !== null && String(value) !== "") return String(value);
      }
    } catch (_) {}
    return fallback;
  }
  function boolParam(name, fallback) {
    var value = String(paramValue(name, fallback ? "true" : "false")).toLowerCase();
    return value === "1" || value === "true" || value === "on" || value === "yes";
  }
  function subtitleType() {
    var value = String(paramValue("subtitle_type", "Translate")).toLowerCase();
    return value === "official" || value === "offical" ? "Official" : "Translate";
  }

  if (subtitleType() !== "Translate") return;
  var showOnly = boolParam("show_only_auto_translation", false);
  var effectiveUrl = String(ctx.url || "");
  var originalUrl = String(ctx.originalUrl || effectiveUrl);
  var rewrittenByNative = !!(originalUrl && effectiveUrl && originalUrl !== effectiveUrl);
  var requestUrl = originalUrl || effectiveUrl;
  var start = Date.now();
  var explicitTarget = queryParamFromUrl(requestUrl, "tlang");
  var targetLang = normalizeLang(explicitTarget || storeGet("ytdual:lastTarget") || "zh-CN", "zh-CN");
  var sourceLang = normalizeLang(queryParamFromUrl(requestUrl, "lang"), "auto");
  var fmt = (queryParamFromUrl(requestUrl, "fmt") || queryParamFromUrl(requestUrl, "format") || "").toLowerCase();
  if (/^zh(?:-|$)/i.test(sourceLang)) {
    return;
  }
  if (!explicitTarget && sameBaseLang(sourceLang, targetLang)) targetLang = "zh-CN";
  if (explicitTarget) storeSet("ytdual:lastTarget", targetLang);

  var upstreamUrl = effectiveUrl || buildUpstreamUrl(requestUrl);
  var urlCacheKey = "ytdualproxy:rowfix1:url:" + hashText(upstreamUrl + "|" + sourceLang + "|" + targetLang + "|" + showOnly);
  var headers = ctx.headers || [];
  var body = ctx.body || new Uint8Array();
  if (!body.length) return;

  var text = bytesToText(body);
  if (!text) return;
  var type = headerValue(headers, "content-type").split(";")[0].toLowerCase();
  var trimmed = text.trim();
  var bodyCacheKey = responseCacheKey(text, sourceLang, targetLang, fmt);
  var cached = storeGet(bodyCacheKey);
  if (cached) {
    storeSet(urlCacheKey, cached);
    respond(200, safeHeaders(headers, fmt), textToBytes(cached));
    return;
  }

  var outText = "";
  var xmlTextMode = false;
  if (type.indexOf("json") >= 0 || fmt.indexOf("json") >= 0 || trimmed.charAt(0) === "{") {
    outText = await translateJson(text, sourceLang, targetLang);
  } else if (type.indexOf("vtt") >= 0 || fmt.indexOf("vtt") >= 0 || /^WEBVTT/i.test(trimmed)) {
    outText = await translateVtt(text, sourceLang, targetLang);
  } else if (type.indexOf("xml") >= 0 || fmt === "srv3" || fmt === "ttml" || trimmed.charAt(0) === "<") {
    xmlTextMode = true; outText = await translateXml(text, sourceLang, targetLang, fmt);
  }
  if (!outText) {
    return;
  }

  storeSet(bodyCacheKey, outText);
  storeSet(urlCacheKey, outText);
  respond(200, safeHeaders(headers, fmt), textToBytes(outText));
  function respond(status, headers, body) {
    ctx.body = body || new Uint8Array();
    Anywhere.done();
  }
  function bytesToText(bytes) {
    try { return Anywhere.codec.utf8.decode(bytes || new Uint8Array()); } catch (_) { return ""; }
  }
  function textToBytes(text) {
    return Anywhere.codec.utf8.encode(String(text == null ? "" : text));
  }
  function headerValue(headers, name) {
    name = String(name || "").toLowerCase();
    headers = headers || [];
    for (var i = 0; i < headers.length; i++) if (String(headers[i][0] || "").toLowerCase() === name) return String(headers[i][1] || "");
    return "";
  }
  function safeHeaders(headers, fmt) {
    var out = [];
    headers = headers || [];
    for (var i = 0; i < headers.length; i++) {
      var name = String(headers[i][0] || "").toLowerCase();
      var value = String(headers[i][1] || "");
      if (!name || /^(?:content-length|content-encoding|transfer-encoding|connection|keep-alive|upgrade|proxy-connection|te|trailer|host)$/.test(name)) continue;
      if (name === "content-type" || name === "cache-control" || name === "expires") out.push([name, value]);
    }
    if (!out.some(function (h) { return h[0] === "content-type"; })) out.push(["content-type", contentTypeForFmt(fmt)]);
    return out;
  }
  function contentTypeForFmt(fmt) {
    if (fmt === "json3" || fmt === "json") return "application/json; charset=utf-8";
    if (fmt === "vtt" || fmt === "webvtt") return "text/vtt; charset=utf-8";
    return "text/xml; charset=utf-8";
  }
  function queryParamFromUrl(url, name) {
    var query = String(url || "").split("#")[0].split("?")[1] || "";
    var parts = query.split("&");
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf("=");
      var key = eq >= 0 ? parts[i].slice(0, eq) : parts[i];
      if (decode(key) === name) return decode(eq >= 0 ? parts[i].slice(eq + 1) : "");
    }
    return "";
  }
  function decode(value) {
    value = String(value == null ? "" : value).replace(/\+/g, " ");
    try { return decodeURIComponent(value); } catch (_) { return value; }
  }
  function encodeQuery(value) {
    return encodeURIComponent(String(value == null ? "" : value));
  }
  function normalizeLang(value, fallback) {
    value = String(value || fallback || "").trim();
    if (!value || value.toLowerCase() === "und") return fallback || "auto";
    var lower = value.toLowerCase();
    if (lower === "zh" || lower === "zh-hans" || lower === "zh-cn") return "zh-CN";
    if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk") return "zh-TW";
    return value;
  }
  function sameBaseLang(left, right) {
    left = String(left || "").toLowerCase().split(/[-_]/)[0];
    right = String(right || "").toLowerCase().split(/[-_]/)[0];
    return !!left && left !== "auto" && left === right;
  }
  function buildUpstreamUrl(url) {
    var hash = "";
    var hashIndex = url.indexOf("#");
    if (hashIndex >= 0) { hash = url.slice(hashIndex); url = url.slice(0, hashIndex); }
    var qIndex = url.indexOf("?");
    if (qIndex < 0) return url + hash;
    var base = url.slice(0, qIndex + 1);
    var parts = url.slice(qIndex + 1).split("&");
    var out = [];
    var hadTlang = false;
    var hasSubtype = false;
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var eq = parts[i].indexOf("=");
      var key = decode(eq >= 0 ? parts[i].slice(0, eq) : parts[i]);
      if (key === "tlang") { hadTlang = true; continue; }
      if (key === "subtype") { hasSubtype = true; out.push("subtype=Translate"); continue; }
      out.push(parts[i]);
    }
    if (hadTlang && !hasSubtype) out.push("subtype=Translate");
    return base + out.join("&") + hash;
  }
  function htmlDecode(value) {
    var entities = {"&amp;":"&", "&lt;":"<", "&gt;":">", "&quot;":'"', "&apos;":"'"};
    return String(value == null ? "" : value).replace(/(&(?:lt|gt|amp|apos|quot|#(?:\d{1,7}|x[0-9a-fA-F]{1,6}));)/g, function (entity) {
      if (entity.charAt(1) === "#") {
        var code = entity.charAt(2) === "x" ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
        if (code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) return String.fromCodePoint(code);
      }
      return entities[entity] || entity;
    });
  }
  function htmlEncode(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function cleanCueText(value) {
    return String(value == null ? "" : value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  function combine(source, translated) {
    translated = xmlTextMode ? String(translated == null ? "" : translated).replace(/\s+/g, " ").trim() : cleanCueText(translated);
    if (!translated) return source;
    source = String(source == null ? "" : source);
    if (showOnly) return translated || source;
    return source ? source + "\n" + translated : translated;
  }
  function googleText(data) {
    var out = [];
    if (Array.isArray(data) && Array.isArray(data[0])) {
      for (var i = 0; i < data[0].length; i++) if (Array.isArray(data[0][i]) && data[0][i][0]) out.push(data[0][i][0]);
    }
    return out.join("");
  }
  async function translateRows(rows, sourceLang, targetLang) {
    var out = new Array(rows.length);
    var sep = "\r";
    var sepCost = encodeQuery(sep).length;
    var maxChunks = 16;
    var maxEncoded = 14000;
    var chunks = [];
    var current = [];
    var currentEncoded = 0;
    var costs = new Array(rows.length);
    var totalEncoded = 0;
    for (var ti = 0; ti < rows.length; ti++) {
      costs[ti] = encodeQuery(String(rows[ti] == null ? "" : rows[ti])).length;
      if (costs[ti] > maxEncoded) return null;
      totalEncoded += costs[ti] + (ti ? sepCost : 0);
    }
    var desiredChunks = Math.max(1, Math.min(12, Math.ceil(totalEncoded / 2800)));
    function pushChunk() {
      if (!current.length) return;
      chunks.push({ offset: 0, rows: current, encoded: currentEncoded });
      current = [];
      currentEncoded = 0;
    }
    for (var ri = 0; ri < rows.length; ri++) {
      var row = String(rows[ri] == null ? "" : rows[ri]);
      var cost = costs[ri] + (current.length ? sepCost : 0);
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
      var largest = -1;
      for (var si = 0; si < chunks.length; si++) {
        if (chunks[si].rows.length > 1 && (largest < 0 || chunks[si].encoded > chunks[largest].encoded)) largest = si;
      }
      if (largest < 0) break;
      var sourceRows = chunks[largest].rows;
      var splitAt = Math.max(1, Math.floor(sourceRows.length / 2));
      var leftRows = sourceRows.slice(0, splitAt);
      var rightRows = sourceRows.slice(splitAt);
      chunks.splice(largest, 1,
        { offset: 0, rows: leftRows, encoded: encodeQuery(leftRows.join(sep)).length },
        { offset: 0, rows: rightRows, encoded: encodeQuery(rightRows.join(sep)).length });
    }
    var offset = 0;
    for (var vi = 0; vi < chunks.length; vi++) {
      chunks[vi].offset = offset;
      offset += chunks[vi].rows.length;
    }
    async function translateChunk(chunk) {
      var url = "http://translate.googleapis.com/translate_a/single?client=gtx&dt=t"
        + "&sl=" + encodeQuery(sourceLang || "auto")
        + "&tl=" + encodeQuery(targetLang || "zh-CN")
        + "&q=" + encodeQuery(chunk.rows.join(sep));
      var res;
      try {
        res = await Anywhere.http.request({
          url: url,
          method: "GET",
          headers: [["accept", "application/json"], ["accept-encoding", "identity"]],
          timeout: 8000,
          redirect: "follow"
        });
      } catch (error) {
        return null;
      }
      if ((res.status || 0) < 200 || (res.status || 0) >= 300 || !res.body) {
        return null;
      }
      var translated;
      try { translated = googleText(JSON.parse(bytesToText(res.body))); } catch (error) { return null; }
      var parts = translated.split(/\r\n?|\n/);
      if (parts.length !== chunk.rows.length) parts = chunk.rows.length === 1 ? [translated] : translated.split(/\n+/);
      var normalized = [];
      for (var j = 0; j < chunk.rows.length; j++) normalized.push((parts[j] || "").trim());
      return normalized;
    }
    for (var ci = 0; ci < chunks.length; ci += 4) {
      var batch = chunks.slice(ci, ci + 4);
      var results = await Promise.all(batch.map(translateChunk));
      for (var bi = 0; bi < results.length; bi++) {
        if (!results[bi]) return null;
        var chunk = batch[bi];
        for (var rj = 0; rj < chunk.rows.length; rj++) out[chunk.offset + rj] = results[bi][rj] || "";
      }
    }
    return out;
  }
  function hashText(value) {
    value = String(value == null ? "" : value);
    var h = 2166136261;
    for (var i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }
  function responseCacheKey(text, sourceLang, targetLang, fmt) {
    return "ytdualproxy:rowfix1:body:" + (queryParamFromUrl(requestUrl, "v") || "-") + ":" + (sourceLang || "auto") + ":" + (targetLang || "zh-CN") + ":" + (fmt || "-") + ":" + showOnly + ":" + text.length + ":" + hashText(text);
  }
  function storeGet(key) {
    try { return Anywhere.store.getString(key) || ""; } catch (_) { return ""; }
  }
  function storeSet(key, value) {
    try { Anywhere.store.set(key, value); } catch (_) {}
  }
  async function translateJson(text, sourceLang, targetLang) {
    var data;
    try { data = JSON.parse(text); } catch (_) { return ""; }
    var slots = [];
    (data.events || []).forEach(function (event) {
      var segs = Array.isArray(event && event.segs) ? event.segs : [];
      var source = segs.map(function (seg) { return seg && seg.utf8 ? seg.utf8 : ""; }).join("").trim();
      if (source) slots.push({ event: event, source: source });
    });
    if (!slots.length) return "";
    var translated = await translateRows(slots.map(function (item) { return item.source; }), sourceLang, targetLang);
    if (!translated) return "";
    slots.forEach(function (item, index) {
      item.event.segs = [{ utf8: combine(item.source, translated[index]) }];
      delete item.event.wWinId;
    });
    return JSON.stringify(data);
  }
  async function translateVtt(text, sourceLang, targetLang) {
    var blocks = text.replace(/\r\n/g, "\n").split(/\n\n+/);
    var cueSlots = [];
    blocks.forEach(function (block, blockIndex) {
      var lines = block.split("\n");
      var timeIndex = -1;
      for (var i = 0; i < lines.length; i++) if (lines[i].indexOf("-->") >= 0) { timeIndex = i; break; }
      if (timeIndex < 0) return;
      var cueText = cleanCueText(lines.slice(timeIndex + 1).join(" "));
      if (cueText) cueSlots.push({ blockIndex: blockIndex, lines: lines, timeIndex: timeIndex, source: cueText });
    });
    if (!cueSlots.length) return "";
    var translated = await translateRows(cueSlots.map(function (item) { return item.source; }), sourceLang, targetLang);
    if (!translated) return "";
    cueSlots.forEach(function (item, index) {
      item.lines.splice(item.timeIndex + 1, item.lines.length - item.timeIndex - 1, combine(item.source, translated[index]));
      blocks[item.blockIndex] = item.lines.join("\n");
    });
    return blocks.join("\n\n");
  }
  function normalizeTimedtextHead(xml) {
    var seen = 0;
    return xml.replace(/<wp\b([^>]*)>/g, function (full, attrs) {
      seen++;
      if (seen === 2 && /\brc="[^"]*"/.test(attrs)) return "<wp" + attrs.replace(/\brc="[^"]*"/, "rc=\"1\"") + ">";
      return full;
    });
  }
  async function translateXml(text, sourceLang, targetLang, fmt) {
    var re = /<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/g;
    var matches = [];
    var match;
    while ((match = re.exec(text))) {
      var cleanSource = htmlDecode(cleanCueText(match[3]));
      if (cleanSource) matches.push({ tag: match[1], attrs: match[2], source: cleanSource });
    }
    if (!matches.length && (fmt === "srv3" || /<s\b/i.test(text))) {
      re = /<(s)\b([^>]*)>([\s\S]*?)<\/\1>/g;
      while ((match = re.exec(text))) {
        var cleanSegment = htmlDecode(cleanCueText(match[3]));
        if (cleanSegment) matches.push({ tag: match[1], attrs: match[2], source: cleanSegment });
      }
    }
    if (!matches.length) {
      return "";
    }
    var translated = await translateRows(matches.map(function (item) { return item.source; }), sourceLang, targetLang);
    if (!translated) return "";
    var idx = 0;
    var out = normalizeTimedtextHead(text).replace(re, function (full, tag, attrs, body) {
      var displaySource = htmlDecode(cleanCueText(body));
      if (!displaySource) return full;
      var translatedText = String(translated[idx++] || "").replace(/\s+/g, " ").trim();
      var newline = tag === "text" ? "&#10;" : "&#x000A;";
      return "<" + tag + attrs + ">" + htmlEncode(combine(displaySource, translatedText)).replace(/\n/g, newline) + "</" + tag + ">";
    });
    return out;
  }
}
