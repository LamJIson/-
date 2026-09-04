function process(ctx) {
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
      Anywhere.done();
    }
  } catch (e) {}
}
