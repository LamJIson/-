function __dualParam(name, fallback) {
  try {
    if (typeof Anywhere !== "undefined" && Anywhere.params) {
      var value = Anywhere.params.get(name);
      if (value !== undefined && value !== null && String(value) !== "") return String(value);
    }
  } catch (_) {}
  return fallback;
}
function __dualBoolParam(name, fallback) {
  var value = String(__dualParam(name, fallback ? "true" : "false")).toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}
function __ytAdProcess(ctx) {
  if (ctx.phase !== "request" || !ctx.url) return;
  if (!ctx.body || !ctx.body.length) return;
  try {
    var pb = Anywhere.codec.protobuf;
    var root = pb.decode(ctx.body);
    var changed = false;
    function setVarint(entries, field, value) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].field === field) {
          if (entries[i].wire !== 0 || entries[i].value !== value) {
            entries[i] = {field: field, wire: 0, value: value};
            return true;
          }
          return false;
        }
      }
      entries.push({field: field, wire: 0, value: value});
      return true;
    }
    for (var i = 0; i < root.length; i++) {
      var contextField = root[i];
      if (contextField.field !== 1 || contextField.wire !== 2) continue;
      var context = pb.decode(contextField.value);
      var contextChanged = false;
      for (var j = 0; j < context.length; j++) {
        var adSignalsField = context[j];
        if (adSignalsField.field !== 9 || adSignalsField.wire !== 2) continue;
        var adSignals = pb.decode(adSignalsField.value);
        var filtered = adSignals.filter(function (entry) { return entry.field !== 1; });
        if (filtered.length !== adSignals.length) {
          adSignalsField.value = pb.encode(filtered);
          contextChanged = true;
        }
      }
      if (contextChanged) {
        contextField.value = pb.encode(context);
        changed = true;
      }
    }
    if (autoCC && ctx.url.indexOf("/youtubei/v1/player") >= 0) {
      for (var p = 0; p < root.length; p++) {
        var playbackField = root[p];
        if (playbackField.field !== 4 || playbackField.wire !== 2) continue;
        var playback = pb.decode(playbackField.value);
        for (var c = 0; c < playback.length; c++) {
          var contentField = playback[c];
          if (contentField.field !== 1 || contentField.wire !== 2) continue;
          var content = pb.decode(contentField.value);
          var contentChanged = false;
          contentChanged = setVarint(content, 4, 1) || contentChanged;
          contentChanged = setVarint(content, 6, 1) || contentChanged;
          contentChanged = setVarint(content, 8, 1) || contentChanged;
          contentChanged = setVarint(content, 9, 1) || contentChanged;
          if (contentChanged) {
            contentField.value = pb.encode(content);
            playbackField.value = pb.encode(playback);
            changed = true;
          }
        }
      }
    }
    if (changed) {
      ctx.body = pb.encode(root);
      ctx.__mitmChanged = true;
    }
  } catch (e) {}
}

function __dualSubsProcess(ctx) {
  if (ctx.phase !== "request" || !ctx.url) return;
  if (!ctx.body || !ctx.body.length) return;
  var autoCC = __dualBoolParam("auto_cc", true);
  var isJsonHost = /^https?:\/\/(?:www|m|tv)\.youtube\.com\/youtubei\/v1\/player(?:\?|$)/.test(ctx.url || "");
  if (isJsonHost) {
    try {
      var text = Anywhere.codec.utf8.decode(ctx.body);
      var json = JSON.parse(text || "{}");
      var content = json && json.playbackContext && json.playbackContext.contentPlaybackContext;
      if (autoCC && content && content.autoCaptionsDefaultOn !== true) {
        content.autoCaptionsDefaultOn = true;
        ctx.body = Anywhere.codec.utf8.encode(JSON.stringify(json));
        ctx.__mitmChanged = true;
      }
    } catch (_) {}
    return;
  }
  try {
    var pb = Anywhere.codec.protobuf;
    var root = pb.decode(ctx.body);
    var changed = false;
    function setVarint(entries, field, value) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].field === field) {
          if (entries[i].wire !== 0 || entries[i].value !== value) {
            entries[i] = {field: field, wire: 0, value: value};
            return true;
          }
          return false;
        }
      }
      entries.push({field: field, wire: 0, value: value});
      return true;
    }
    for (var i = 0; i < root.length; i++) {
      var contextField = root[i];
      if (contextField.field !== 1 || contextField.wire !== 2) continue;
      var context = pb.decode(contextField.value);
      var contextChanged = false;
      for (var j = 0; j < context.length; j++) {
        var adSignalsField = context[j];
        if (adSignalsField.field !== 9 || adSignalsField.wire !== 2) continue;
        var adSignals = pb.decode(adSignalsField.value);
        var filtered = adSignals.filter(function (entry) { return entry.field !== 1; });
        if (filtered.length !== adSignals.length) {
          adSignalsField.value = pb.encode(filtered);
          contextChanged = true;
        }
      }
      if (contextChanged) {
        contextField.value = pb.encode(context);
        changed = true;
      }
    }
    if (ctx.url.indexOf("/youtubei/v1/player") >= 0) {
      for (var p = 0; p < root.length; p++) {
        var playbackField = root[p];
        if (playbackField.field !== 4 || playbackField.wire !== 2) continue;
        var playback = pb.decode(playbackField.value);
        for (var c = 0; c < playback.length; c++) {
          var contentField = playback[c];
          if (contentField.field !== 1 || contentField.wire !== 2) continue;
          var content = pb.decode(contentField.value);
          var contentChanged = false;
          contentChanged = setVarint(content, 4, 1) || contentChanged;
          contentChanged = setVarint(content, 6, 1) || contentChanged;
          contentChanged = setVarint(content, 8, 1) || contentChanged;
          contentChanged = setVarint(content, 9, 1) || contentChanged;
          if (contentChanged) {
            contentField.value = pb.encode(content);
            playbackField.value = pb.encode(playback);
            changed = true;
          }
        }
      }
    }
    if (changed) {
      ctx.body = pb.encode(root);
      ctx.__mitmChanged = true;
    }
  } catch (e) {}
}

async function process(ctx) {
  ctx.__mitmChanged = false;
  try { __ytAdProcess(ctx); } catch (_) {}
  try { __dualSubsProcess(ctx); } catch (_) {}
  if (ctx.__mitmChanged) Anywhere.done();
}
