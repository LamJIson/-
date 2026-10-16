// ========== Anywhere -> Loon Compatibility Shim ==========
// Minimal mapping to allow DualSubs-style scripts to run under Loon

const Anywhere = (() => {
  // ---- params from $argument ----
  const _arg = (() => {
    try {
      if (typeof $argument === "string" && $argument) {
        // Loon can pass argument as query string or JSON
        if ($argument.startsWith("{")) return JSON.parse($argument);
        const o = {};
        $argument.split("&").forEach(p => {
          const [k, v] = p.split("=");
          if (k) o[decodeURIComponent(k)] = decodeURIComponent(v || "");
        });
        return o;
      }
      if (typeof $argument === "object" && $argument) return $argument;
    } catch (e) {}
    return {};
  })();

  // ---- persistent store ----
  const store = {
    getString(key) {
      try { return $persistentStore.read(key) || null; } catch (e) { return null; }
    },
    set(key, value) {
      try { $persistentStore.write(String(value), key); } catch (e) {}
    }
  };

  // ---- codec ----
  const codec = {
    utf8: {
      encode(str) {
        if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
        // fallback
        const utf8 = unescape(encodeURIComponent(str));
        const arr = new Uint8Array(utf8.length);
        for (let i = 0; i < utf8.length; i++) arr[i] = utf8.charCodeAt(i);
        return arr;
      },
      decode(bytes) {
        if (!bytes) return "";
        if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
        let str = "";
        const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
        try { return decodeURIComponent(escape(str)); } catch (e) { return str; }
      }
    },
    protobuf: {
      // very limited stub - real protobuf handling may fail
      decode(bytes) { return []; },
      encode(entries) { return new Uint8Array(); }
    }
  };

  // ---- http ----
  function httpRequest(opts) {
    return new Promise((resolve, reject) => {
      const method = (opts.method || "GET").toUpperCase();
      const headers = {};
      if (Array.isArray(opts.headers)) {
        opts.headers.forEach(([k, v]) => { headers[k] = v; });
      } else if (opts.headers) {
        Object.assign(headers, opts.headers);
      }
      let body = opts.body;
      if (body instanceof Uint8Array) {
        body = codec.utf8.decode(body);
      }
      $httpClient[method.toLowerCase()]({
        url: opts.url,
        headers,
        body,
        timeout: Math.min((opts.timeout || 8000) / 1000, 20)
      }, (err, resp, data) => {
        if (err) return reject(err);
        let respBody = data;
        if (typeof data === "string") {
          respBody = codec.utf8.encode(data);
        }
        const hlist = [];
        if (resp && resp.headers) {
          for (const k in resp.headers) hlist.push([k, resp.headers[k]]);
        }
        resolve({
          status: resp ? resp.status : 0,
          headers: hlist,
          body: respBody,
          url: opts.url
        });
      });
    });
  }

  const http = {
    request: httpRequest,
    get: (url, opts = {}) => httpRequest({ ...opts, url, method: "GET" }),
    post: (url, opts = {}) => httpRequest({ ...opts, url, method: "POST" })
  };

  // ---- log ----
  const log = {
    warning(msg) { console.log("[YT-WARN] " + msg); },
    info(msg) { console.log("[YT-INFO] " + msg); },
    error(msg) { console.log("[YT-ERR] " + msg); }
  };

  // ---- respond (for request phase short-circuit) ----
  function respond(obj) {
    const headers = {};
    if (Array.isArray(obj.headers)) {
      obj.headers.forEach(([k, v]) => { headers[k] = v; });
    } else if (obj.headers) {
      Object.assign(headers, obj.headers);
    }
    let body = obj.body;
    if (body instanceof Uint8Array) {
      body = codec.utf8.decode(body);
    }
    $done({
      response: {
        status: obj.status || 200,
        headers,
        body: body || ""
      }
    });
  }

  // ---- params ----
  const params = {
    get(name) {
      if (_arg[name] !== undefined && _arg[name] !== null && String(_arg[name]) !== "") {
        return String(_arg[name]);
      }
      // fallback to persistent store with common prefixes
      const v = store.getString("DualSubs:" + name) || store.getString(name);
      return v;
    }
  };

  return { params, store, codec, http, log, respond, done: () => $done({}) };
})();

// Helper to build ctx from Loon environment
function __buildCtx(phase) {
  const ctx = {
    phase: phase,
    url: "",
    originalUrl: "",
    method: "GET",
    status: 200,
    headers: [],
    body: null
  };
  if (phase === "request" && typeof $request !== "undefined") {
    ctx.url = $request.url || "";
    ctx.originalUrl = $request.url || "";
    ctx.method = $request.method || "GET";
    if ($request.headers) {
      ctx.headers = Object.entries($request.headers);
    }
    if ($request.body) {
      if (typeof $request.body === "string") {
        ctx.body = Anywhere.codec.utf8.encode($request.body);
      } else {
        ctx.body = $request.body;
      }
    }
  }
  if (phase === "response" && typeof $response !== "undefined") {
    ctx.url = ($request && $request.url) || "";
    ctx.originalUrl = ctx.url;
    ctx.status = $response.status || 200;
    if ($response.headers) {
      ctx.headers = Object.entries($response.headers);
    }
    if ($response.body !== undefined && $response.body !== null) {
      if (typeof $response.body === "string") {
        ctx.body = Anywhere.codec.utf8.encode($response.body);
      } else {
        ctx.body = $response.body;
      }
    }
  }
  return ctx;
}

// ---- end of shim ----


function __fullCaptionDiagnostic(ctx,stage,detail){
 try{
  if(String(Anywhere.params.get('subtitle_diagnostics')||'true')!=='true')return;
  if(!Anywhere.log||typeof Anywhere.log.warning!=='function')return;
  const key='ytfull:diagnostic:'+stage,now=Date.now(),last=Number(Anywhere.store.getString(key)||0);
  if(last&&now-last<15000)return;
  try{Anywhere.store.set(key,String(now));}catch(error){return;}
  Anywhere.log.warning('YT-FULL-D13 '+stage+' '+detail);
 }catch(error){}
}

var __DualSubsCore=(()=>{var __defProp=Object.defineProperty;var __getOwnPropDesc=Object.getOwnPropertyDescriptor;var __getOwnPropNames=Object.getOwnPropertyNames;var __hasOwnProp=Object.prototype.hasOwnProperty;var __export=(target,all)=>{for(var name in all)__defProp(target,name,{get:all[name],enumerable:true})};var __copyProps=(to,from,except,desc)=>{if(from&&typeof from==="object"||typeof from==="function"){for(let key of __getOwnPropNames(from))if(!__hasOwnProp.call(to,key)&&key!==except)__defProp(to,key,{get:()=>from[key],enumerable:!(desc=__getOwnPropDesc(from,key))||desc.enumerable})}return to};var __toCommonJS=mod=>__copyProps(__defProp({},"__esModule",{value:true}),mod);var dualsubs_core_entry_exports={};__export(dualsubs_core_entry_exports,{Composite:()=>Composite,Translate:()=>Translate,fetch:()=>fetch});var Console={log(){},info(){},debug(){},warn(){},error(){}};var total=0;var active=0;var waiting=[];async function fetch(request){if(++total>16)throw Error("DualSubs request budget exceeded");if(active>=4)await new Promise(resolve=>waiting.push(resolve));else active++;try{let url=request.url,body=request.body;if(/^https:\/\/(translation|translate)\.googleapis\.com\/(language|v3)\//.test(url)&&typeof body==="string"){const value=JSON.parse(body);if(value.source==="auto")delete value.source;if(value.sourceLanguageCode==="auto")delete value.sourceLanguageCode;body=JSON.stringify(value)}if(/microsofttranslator|api\.translator\.azure/.test(url))url=url.replace(/([?&])from=auto(?=&|$)/,"$1").replace("?&","?");let response;try{response=await Anywhere.http.request({url,method:request.method||(body===void 0?"GET":"POST"),headers:Object.entries(request.headers||{}),body:typeof body==="string"?Anywhere.codec.utf8.encode(body):body,timeout:8e3,redirect:"follow"})}catch(error){const message=String(error).toLowerCase(),code=/timed.?out|timeout/.test(message)?"transport-timeout":/certificate|tls|ssl/.test(message)?"transport-tls":/cap|budget|concurrent/.test(message)?"request-budget":/expected.*url|invalid.*url/.test(message)?"request-url":"transport-failed";throw Error("YT:"+code)}if(response.status<200||response.status>=300)throw Error("DualSubs HTTP "+response.status);const text=Anywhere.codec.utf8.decode(response.body);if(/\/translate_a\/(single|t)(?:\?|$)/.test(url)){const encoding=(response.headers||[]).find(h=>String(h[0]).toLowerCase()==="content-encoding")?.[1]||"";if(/gzip|br|deflate/i.test(encoding))throw Error("YT:compressed-response");if(/^\s*</.test(text))throw Error("YT:html-response")}return{status:response.status,headers:Object.fromEntries(response.headers||[]),body:text}}finally{const next=waiting.shift();if(next)next();else active--}}var Translate=class{constructor(options={}){this.Name="Translate";this.Version="1.0.7";Console.log(`\u{1F7E7} ${this.Name} v${this.Version}`);this.Source="AUTO";this.Target="ZH";this.API={};Object.assign(this,options)}#LanguagesCode={Google:{AUTO:"auto",AF:"af",AM:"am",AR:"ar",AS:"as",AY:"ay",AZ:"az",BG:"bg",BE:"be",BM:"bm",BN:"bn",BHO:"bho",CS:"cs",DA:"da",DE:"de",EL:"el",EU:"eu",EN:"en","EN-GB":"en","EN-US":"en","EN-US SDH":"en",ES:"es","ES-419":"es","ES-ES":"es",ET:"et",FI:"fi",FR:"fr","FR-CA":"fr",HU:"hu",ID:"id",IS:"is",IT:"it",JA:"ja",KM:"km",KO:"ko",LT:"lt",LV:"lv",NL:"nl",NO:"no",PL:"pl",PT:"pt","PT-PT":"pt","PT-BR":"pt",PA:"pa",RO:"ro",RU:"ru",SK:"sk",SL:"sl",SQ:"sq",ST:"st",SV:"sv",TH:"th",TR:"tr",UK:"uk",UR:"ur",VI:"vi",ZH:"zh","ZH-HANS":"zh-CN","ZH-HK":"zh-TW","ZH-HANT":"zh-TW"},Microsoft:{AUTO:"",AF:"af",AM:"am",AR:"ar",AS:"as",AY:"ay",AZ:"az",BG:"bg",BE:"be",BM:"bm",BN:"bn",BHO:"bho",CS:"cs",DA:"da",DE:"de",EL:"el",EU:"eu",EN:"en","EN-GB":"en","EN-US":"en","EN-US SDH":"en",ES:"es","ES-419":"es","ES-ES":"es",ET:"et",FI:"fi",FR:"fr","FR-CA":"fr-ca",HU:"hu",ID:"id",IS:"is",IT:"it",JA:"ja",KM:"km",KO:"ko",LT:"lt",LV:"lv",NL:"nl",NO:"no",PL:"pl",PT:"pt","PT-PT":"pt-pt","PT-BR":"pt",PA:"pa",RO:"ro",RU:"ru",SK:"sk",SL:"sl",SQ:"sq",ST:"st",SV:"sv",TH:"th",TR:"tr",UK:"uk",UR:"ur",VI:"vi",ZH:"zh-Hans","ZH-HANS":"zh-Hans","ZH-HK":"yue","ZH-HANT":"zh-Hant"},DeepL:{AUTO:"",BG:"BG",CS:"CS",DA:"DA",DE:"de",EL:"el",EN:"EN",ES:"ES",ET:"ET",FI:"FI",FR:"FR",HU:"HU",ID:"ID",IT:"IT",JA:"JA",KO:"ko",LT:"LT",LV:"LV",NL:"NL",PL:"PL",PT:"PT",RO:"RO",RU:"RU",SK:"SK",SL:"SL",SV:"SV",TR:"TR",ZH:"ZH"},Baidu:{AUTO:"auto",AR:"ara",CS:"cs",DA:"dan",DE:"de",EL:"el",EN:"en",ES:"spa",ET:"est",FI:"fin",FR:"fra",HU:"hu",IT:"it",JA:"jp",KO:"kor",NL:"nl",PL:"pl",PT:"pt",RO:"RO",RU:"rom",SL:"slo",SV:"swe",TH:"th",VI:"vie",ZH:"zh","ZH-HANS":"zh","ZH-HK":"cht","ZH-HANT":"cht"}};#UAPool=["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36","Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:94.0) Gecko/20100101 Firefox/94.0","Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:95.0) Gecko/20100101 Firefox/95.0","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36","Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134","Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148","Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1","Mozilla/5.0 (Windows NT 10.0; Win64; x64)","Mozilla/5.0 (Windows NT 6.1; WOW64; rv:52.0) Gecko/20100101 Firefox/52.0"];#Length={Google:120,GoogleCloud:120,Microsoft:99,Azure:99,DeepL:49};async Google(text=[],source=this.Source,target=this.Target){text=Array.isArray(text)?text:[text];source=this.#LanguagesCode.Google[source]??this.#LanguagesCode.Google[source?.split?.(/[-_]/)?.[0]]??source.toLowerCase();target=this.#LanguagesCode.Google[target]??this.#LanguagesCode.Google[target?.split?.(/[-_]/)?.[0]]??target.toLowerCase();const BaseRequest=[{url:"https://translate.googleapis.com/translate_a/single?client=gtx&dt=t",headers:{Accept:"*/*","User-Agent":this.#UAPool[Math.floor(Math.random()*this.#UAPool.length)],Referer:"https://translate.google.com"}},{url:"https://clients5.google.com/translate_a/t?client=dict-chrome-ex",headers:{Accept:"*/*","User-Agent":this.#UAPool[Math.floor(Math.random()*this.#UAPool.length)]}},{url:"https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8",headers:{Accept:"*/*","User-Agent":"GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"}},{url:"https://translate.googleapis.com/translate_a/single?client=gtx&dj=1&source=bubble&dt=t&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t&dt=at",headers:{Accept:"*/*","User-Agent":"GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"}}];const request=BaseRequest[this.GoogleEndpoint===0?0:1];request.url=`${request.url}&sl=${source}&tl=${target}&q=${encodeURIComponent(text.join("\r"))}`;return await fetch(request).then(response=>{const body=JSON.parse(response.body);if(Array.isArray(body)){if(Array.isArray(body?.[0])){if(body.length===1){body[0].pop();text=body[0]??`\u7FFB\u8BD1\u5931\u8D25, vendor: ${"google"}`}else text=body?.[0]?.map(item=>item?.[0]??`\u7FFB\u8BD1\u5931\u8D25, vendor: ${"google"}`)}else text=body??`\u7FFB\u8BD1\u5931\u8D25, vendor: ${"google"}`}else if(body?.sentences)text=body?.sentences?.map(item=>item?.trans??`\u7FFB\u8BD1\u5931\u8D25, vendor: ${"google"}`);return text?.join("")?.split(/\r/)}).catch(error=>Promise.reject(error))}async GoogleCloud(text=[],source=this.Source,target=this.Target,api=this.API){text=Array.isArray(text)?text:[text];source=this.#LanguagesCode.Google[source]??this.#LanguagesCode.Google[source?.split?.(/[-_]/)?.[0]]??source.toLowerCase();target=this.#LanguagesCode.Google[target]??this.#LanguagesCode.Google[target?.split?.(/[-_]/)?.[0]]??target.toLowerCase();const request={};const BaseURL="https://translation.googleapis.com";switch(api?.Version){case"v2":default:request.url=`${BaseURL}/language/translate/v2`;request.headers={"User-Agent":"DualSubs","Content-Type":"application/json; charset=utf-8"};request.body=JSON.stringify({q:text,source,target,format:"html"});switch(api?.Mode){case"Token":request.headers.Authorization=`Bearer ${api?.Token??api?.Auth}`;break;case"Key":default:request.url+=`?key=${api?.Key??api?.Auth}`;break}break;case"v3":if(!api?.ID)throw Error("GoogleCloud v3 requires project");request.url=`https://translate.googleapis.com/v3/projects/${encodeURIComponent(api.ID)}/locations/global:translateText`;request.headers={Authorization:`Bearer ${api?.Token??api?.Auth}`,"x-goog-user-project":api?.ID,"User-Agent":"DualSubs","Content-Type":"application/json; charset=utf-8"};request.body=JSON.stringify({sourceLanguageCode:source,targetLanguageCode:target,contents:Array.isArray(text)?text:[text],mimeType:"text/html"});break}return await fetch(request).then(response=>{const body=JSON.parse(response.body);return(api?.Version==="v3"?body?.translations:body?.data?.translations)?.map(item=>item?.translatedText??`\u7FFB\u8BD1\u5931\u8D25, vendor: ${"GoogleCloud"}`)}).catch(error=>Promise.reject(error))}async Microsoft(text=[],source=this.Source,target=this.Target,api=this.API){text=Array.isArray(text)?text:[text];source=this.#LanguagesCode.Microsoft[source]??this.#LanguagesCode.Microsoft[source?.split?.(/[-_]/)?.[0]]??source.toLowerCase();target=this.#LanguagesCode.Microsoft[target]??this.#LanguagesCode.Microsoft[target?.split?.(/[-_]/)?.[0]]??target.toLowerCase();const request={};let BaseURL="https://api.cognitive.microsofttranslator.com";switch(api?.Version){case"Azure":default:BaseURL="https://api.cognitive.microsofttranslator.com";break;case"AzureCN":BaseURL="https://api.translator.azure.cn";break;case"AzureUS":BaseURL="https://api.cognitive.microsofttranslator.us";break}request.url=`${BaseURL}/translate?api-version=3.0&textType=html&${source?`from=${source}`:""}&to=${target}`;request.headers={"Content-Type":"application/json; charset=UTF-8",Accept:"application/json, text/javascript, */*; q=0.01","Accept-Language":"zh-hans"};switch(api?.Mode){case"Token":default:request.headers.Authorization=`Bearer ${api?.Token??api?.Auth}`;break;case"Key":request.headers["Ocp-Apim-Subscription-Key"]=api?.Key??api?.Auth;request.headers["Ocp-Apim-Subscription-Region"]=api?.Region;break}text=text.map(item=>{return{text:item}});request.body=JSON.stringify(text);return await fetch(request).then(response=>{const body=JSON.parse(response.body);return body?.map(item=>item?.translations?.[0]?.text??`\u7FFB\u8BD1\u5931\u8D25, vendor: ${"Microsoft"}`)}).catch(error=>Promise.reject(error))}async DeepL(text=[],source=this.Source,target=this.Target,api=this.API){text=Array.isArray(text)?text:[text];source=this.#LanguagesCode.DeepL[source]??this.#LanguagesCode.DeepL[source?.split?.(/[-_]/)?.[0]]??source.toLowerCase();target=this.#LanguagesCode.DeepL[target]??this.#LanguagesCode.DeepL[target?.split?.(/[-_]/)?.[0]]??target.toLowerCase();const request={};let BaseURL="https://api-free.deepl.com";switch(api?.Version){case"Free":default:BaseURL="https://api-free.deepl.com";break;case"Pro":BaseURL="https://api.deepl.com";break}request.url=`${BaseURL}/v2/translate`;request.headers={"User-Agent":"DualSubs","Content-Type":"application/json",Authorization:`DeepL-Auth-Key ${api?.Token??api?.Auth}`};const body={text,target_lang:target,tag_handling:"html"};if(source)body.source_lang=source;request.body=JSON.stringify(body);return await fetch(request).then(response=>{const body2=JSON.parse(response.body);return body2?.translations?.map(item=>item?.text??`\u7FFB\u8BD1\u5931\u8D25, vendor: ${"DeepL"}`)}).catch(error=>Promise.reject(error))}};var Composite=class{constructor(options={}){this.Name="Composite";this.Version="1.0.2";this.Offset=0;this.Tolerance=0;this.Position="Forward";Object.assign(this,options);Console.log(`\u{1F7E7} ${this.Name} v${this.Version}`)}JSON(Sub1={},Sub2={},Kind="captions",Offset=this.Offset,Tolerance=this.Tolerance,Position=this.Position){Console.log("\u2611\uFE0F Composite JSON Subtitles",`Offset:${Offset}`,`Tolerance:${Tolerance}`,`Position:${Position}`);let DualSub=Sub1;let index0=0,index1=0,index2=0;const length1=Sub1?.events?.length,length2=Sub2?.events?.length;switch(Kind){case"asr":Console.info("DualSub\u662F\u81EA\u52A8\u751F\u6210\u5B57\u5E55");index0=1,index1=1,index2=1;Sub1.events=Sub1.events.map(event=>{if(event?.segs){if(Array.isArray(event?.segs))event.segs=[{utf8:event.segs.map(seg=>seg.utf8).join("")}]}delete event.wWinId;return event});Sub2.events=Sub2.events.map(event=>{if(event?.segs){if(Array.isArray(event?.segs))event.segs=[{utf8:event.segs.map(seg=>seg.utf8).join("")}]}delete event.wWinId;return event});case"captions":default:while(index1<length1&&index2<length2){const timeStamp1=Sub1.events[index1].tStartMs,timeStamp2=Sub2.events[index2].tStartMs;const timeStamp1Next=Sub1.events[index1+1]?.tStartMs??timeStamp1,timeStamp2Next=Sub2.events[index2+1]?.tStartMs??timeStamp2;if(Math.abs(timeStamp1-timeStamp2)<=Tolerance){index0=index1;const text1=Sub1.events[index1]?.segs?.[0].utf8??"",text2=Sub2.events[index2]?.segs?.[0].utf8??"";DualSub.events[index0].segs=[{utf8:(Position==="Reverse"?`${text2}
${text1}`:`${text1}
${text2}`).trim()}]}if(Math.abs(timeStamp1Next-timeStamp2Next)<=Tolerance){index1++;index2++}else{if(timeStamp2>timeStamp1)index1++;else if(timeStamp1>timeStamp2)index2++;else{index1++;index2++}}}}Console.log("\u2705 Composite JSON Subtitles");return DualSub}timedText(Sub1={},Sub2={},Kind="captions",Offset=this.Offset,Tolerance=this.Tolerance,Position=this.Position){Console.log("\u2611\uFE0F Composite timedText Subtitles",`Offset: ${Offset}`,`Tolerance: ${Tolerance}`,`Position: ${Position}`);let DualSub=Sub1;let index0=0,index1=0,index2=0;const length1=Sub1?.timedtext?.body?.p?.length,length2=Sub2?.timedtext?.body?.p?.length;switch(Kind){case"asr":Console.info("DualSub\u662F\u81EA\u52A8\u751F\u6210\u5B57\u5E55");DualSub.timedtext.head.wp[1]["@rc"]="1";Sub1.timedtext.body.p=Sub1.timedtext.body.p.map(para=>{if(para?.s){if(Array.isArray(para?.s))para["#"]=para?.s.map(seg=>seg["#"]).join("");else para["#"]=para.s?.["#"]??"";delete para.s}return para});Sub2.timedtext.body.p=Sub2.timedtext.body.p.map(para=>{if(para?.s){if(Array.isArray(para?.s))para["#"]=para?.s.map(seg=>seg["#"]).join("");else para["#"]=para.s?.["#"]??"";delete para.s}return para});case"captions":default:while(index1<length1&&index2<length2){const timeStamp1=parseInt(Sub1.timedtext.body.p[index1]["@t"],10),timeStamp2=parseInt(Sub2.timedtext.body.p[index2]["@t"],10);const timeStamp1Next=parseInt(Sub1.timedtext.body.p[index1+1]?.["@t"]??timeStamp1,10),timeStamp2Next=parseInt(Sub2.timedtext.body.p[index2+1]?.["@t"]??timeStamp2,10);if(Math.abs(timeStamp1-timeStamp2)<=Tolerance){index0=index1;const text1=Sub1.timedtext.body.p[index1]?.["#"]??"",text2=Sub2.timedtext.body.p[index2]?.["#"]??"";DualSub.timedtext.body.p[index0]["#"]=(Position==="Reverse"?`${text2}
${text1}`:`${text1}
${text2}`).trim()}if(Math.abs(timeStamp1Next-timeStamp2Next)<=Tolerance){index1++;index2++}else{if(timeStamp2>timeStamp1)index1++;else if(timeStamp1>timeStamp2)index2++;else{index1++;index2++}}}break}Console.log("\u2705 Composite timedText Subtitles");return DualSub}webVTT(Sub1={},Sub2={},Offset=this.Offset,Tolerance=this.Tolerance,Position=this.Position){Console.log("\u2611\uFE0F Composite webVTT Subtitles",`Offset: ${Offset}`,`Tolerance: ${Tolerance}`,`Position: ${Position}`);let DualSub=Sub1;let index0=0,index1=0,index2=0;const length1=Sub1?.body?.length,length2=Sub2?.body?.length;while(index1<length1&&index2<length2){const timeStamp1=Sub1.body[index1].timeStamp,timeStamp2=Sub2.body[index2].timeStamp;const timeStamp1Next=Sub1.body[index1+1]?.timeStamp??timeStamp1,timeStamp2Next=Sub2.body[index2+1]?.timeStamp??timeStamp2;const text1=Sub1.body[index1]?.text??"",text2=Sub2.body[index2]?.text??"";if(Math.abs(timeStamp1-timeStamp2)<=Tolerance){index0=index1;DualSub.body[index0].text=(Position==="Reverse"?`${text2}
${text1}`:`${text1}
${text2}`).trim()}if(Math.abs(timeStamp1Next-timeStamp2Next)<=Tolerance){index1++;index2++}else{if(timeStamp2>timeStamp1)index1++;else if(timeStamp1>timeStamp2)index2++;else{index1++;index2++}}}Console.log("\u2705 Composite webVTT Subtitles");return DualSub}spotifyLyric(Lyric1=[],Lyric2=[],Offset=this.Offset,Tolerance=this.Tolerance,Position=this.Position){Console.log("\u2611\uFE0F Composite Spotify Lyrics",`Offset: ${Offset}`,`Tolerance: ${Tolerance}`,`Position: ${Position}`);let Lyric=Lyric1;let index0=0,index1=0,index2=0;const length1=Lyric1?.length,length2=Lyric2?.length;while(index1<length1&&index2<length2){const timeStamp1=Lyric1[index1].startTimeMs,timeStamp2=Lyric2[index2].startTimeMs+Offset;const timeStamp1Next=Lyric1[index1+1]?.startTimeMs??timeStamp1,timeStamp2Next=Lyric2[index2+1]?.startTimeMs+this.Offset;const text1=Lyric1[index1]?.words??"",text2=Lyric2[index2]?.words??"";if(Math.abs(timeStamp1-timeStamp2)<=Tolerance){index0=index1;Lyric[index0].words=(Position==="Reverse"?`${text2}
${text1}`:`${text1}
${text2}`).trim();Lyric[index0].owords=text1.trim();Lyric[index0].twords=text2.trim()}if(Math.abs(timeStamp1Next-timeStamp2Next)<=Tolerance){index1++;index2++}else{if(timeStamp2>timeStamp1)index1++;else if(timeStamp1>timeStamp2)index2++;else{index1++;index2++}}}Console.log("\u2705 Composite Spotify Lyrics");return Lyric}};return __toCommonJS(dualsubs_core_entry_exports);})();

var __DualSubsFormats=(()=>{var __defProp=Object.defineProperty;var __getOwnPropDesc=Object.getOwnPropertyDescriptor;var __getOwnPropNames=Object.getOwnPropertyNames;var __hasOwnProp=Object.prototype.hasOwnProperty;var __export=(target,all)=>{for(var name in all)__defProp(target,name,{get:all[name],enumerable:true})};var __copyProps=(to,from,except,desc)=>{if(from&&typeof from==="object"||typeof from==="function"){for(let key of __getOwnPropNames(from))if(!__hasOwnProp.call(to,key)&&key!==except)__defProp(to,key,{get:()=>from[key],enumerable:!(desc=__getOwnPropDesc(from,key))||desc.enumerable})}return to};var __toCommonJS=mod=>__copyProps(__defProp({},"__esModule",{value:true}),mod);var stdin_exports={};__export(stdin_exports,{VTT:()=>WebVTT,XML:()=>XML});var XML_ORDER=Symbol("XML_ORDER");var XML=class{static name="XML";static version="0.4.5";static about=()=>console.log(`
\u{1F7E7} ${this.name} v${this.version}
`);static#ATTRIBUTE_KEY="@";static#CHILD_NODE_KEY="#";static#UNESCAPE={"&amp;":"&","&lt;":"<","&gt;":">","&apos;":"'","&quot;":'"'};static#ESCAPE={"&":"&amp;","<":"&lt;",">":"&gt;","'":"&apos;",'"':"&quot;"};static parse(xml=new String,reviver=""){const UNESCAPE=this.#UNESCAPE;const ATTRIBUTE_KEY=this.#ATTRIBUTE_KEY;const CHILD_NODE_KEY=this.#CHILD_NODE_KEY;const DOM=toDOM(xml);const json=fromXML(DOM,reviver);return json;function toDOM(text){const list=text.split(/<([^!<>?](?:'[\S\s]*?'|"[\S\s]*?"|[^'"<>])*|!(?:--[\S\s]*?--|\[[^[\]'"<>]+\[[\S\s]*?]]|DOCTYPE[^[<>]*?\[[\S\s]*?]|(?:ENTITY[^"<>]*?"[\S\s]*?")?[\S\s]*?)|\?[\S\s]*?\?)>/);const length=list.length;const root={children:[]};let elem=root;const stack=[];for(let i=0;i<length;){const str=list[i++];if(str)appendText(str);const tag=list[i++];if(tag)parseNode(tag)}return root;function parseNode(tag){const tags=tag.split(" ");const name=tags.shift();const length2=tags.length;let child={};switch(name[0]){case"/":{const closed=tag.replace(/^\/|[\s/].*$/g,"").toLowerCase();while(stack.length){const tagName=elem?.name?.toLowerCase?.();elem=stack.pop();if(tagName===closed)break}break}case"?":child.name=name;child.raw=tags.join(" ");appendChild(child);break;case"!":if(/!\[CDATA\[([\s\S]*?)\]\]/.test(tag)){child.name="!CDATA";child.raw=tag.match(/!\[CDATA\[(?<raw>[\s\S]*?)\]\]/)?.groups?.raw}else if(/!--([\s\S]*?)--/.test(tag)){child.name="!--";child.raw=tag.match(/!--(?<raw>[\s\S]*?)--/)?.groups?.raw}else{child.name=name;child.raw=tags.join(" ")}appendChild(child);break;default:child=openTag(tag);appendChild(child);switch((tags?.[length2-1]??name).slice(-1)){case"/":delete child.children;break;default:stack.push(elem);elem=child;break}break}function openTag(tag2){const elem2={children:[]};tag2=tag2.replace(/\s*\/?$/,"");const pos=tag2.search(/[\s='"/]/);if(pos<0){elem2.name=tag2}else{elem2.name=tag2.substr(0,pos);elem2.tag=tag2.substr(pos)}return elem2}}function appendText(str){if(elem!==root||str.trim())appendChild(unescapeXML(str))}function appendChild(child){elem.children.push(child)}}function fromPlist(elem,reviver2){let object;switch(typeof elem){case"string":case"undefined":object=elem;break;case"object":{const name=elem.name;const children=["plist","dict","array"].includes(name)?elem.children.filter(child=>typeof child!=="string"||child.trim()):elem.children;object={};switch(name){case"plist":{const plist=fromPlist(children[0],reviver2);object=Object.assign(object,plist);break}case"dict":{let dict=children.map(child=>fromPlist(child,reviver2));dict=chunk(dict,2);object=Object.fromEntries(dict);break}case"array":if(!Array.isArray(object))object=[];object=children.map(child=>fromPlist(child,reviver2));break;case"key":{const key=children[0];object=key;break}case"true":case"false":{const boolean=name;object=JSON.parse(boolean);break}case"integer":{const integer=children[0];object=BigInt(integer);break}case"real":{const real=children[0];object=Number.parseFloat(real);break}case"string":{const string=children[0];object=string;break}}if(reviver2)object=reviver2(name||"",object);break}}return object;function chunk(source,length){var index=0,target=[];while(index<source.length)target.push(source.slice(index,index+=length));return target}}function fromXML(elem,reviver2){let object;const order=[];switch(typeof elem){case"string":case"undefined":object=elem;break;case"object":{const raw=elem.raw;const name=elem.name;const tag=elem.tag;const children=elem.children;if(raw!==void 0)object=raw;else if(tag)object=parseAttribute(tag,reviver2);else if(!children)object={[name]:void 0};else object={};if(name==="plist"){const content=children.find(child=>typeof child!=="string"||child.trim());object=Object.assign(object,fromPlist(content,reviver2))}else children?.forEach?.((child,i)=>{const value=fromXML(child,reviver2);if(typeof child==="string"){addObject(object,CHILD_NODE_KEY,value,void 0,order)}else{const prevKey=child.raw!==void 0||child.tag||child.children?void 0:children?.[i-1]?.name;addObject(object,child.name,value,prevKey,order)}});if(children&&children.length===0)addObject(object,CHILD_NODE_KEY,null,void 0);if(order.length)Object.defineProperty(object,XML_ORDER,{value:order});if(reviver2)object=reviver2(name||"",object);break}}return object;function parseAttribute(tag,reviver3){if(!tag)return;const list=tag.split(/([^\s='"]+(?:\s*=\s*(?:'[\S\s]*?'|"[\S\s]*?"|[^\s'"]*))?)/);const length=list.length;let attributes,val;for(let i=0;i<length;i++){let str=removeSpaces(list[i]);if(!str)continue;if(!attributes){attributes={}}const pos=str.indexOf("=");if(pos<0){str=ATTRIBUTE_KEY+str;val=null}else{val=str.substr(pos+1).replace(/^\s+/,"");str=ATTRIBUTE_KEY+str.substr(0,pos).replace(/\s+$/,"");const firstChar=val[0];const lastChar=val[val.length-1];if(firstChar===lastChar&&(firstChar==="'"||firstChar==='"')){val=val.substr(1,val.length-2)}val=unescapeXML(val)}if(reviver3)val=reviver3(str,val);addObject(attributes,str,val)}return attributes;function removeSpaces(str){return str?.trim?.()}}function addObject(object2,key,val,prevKey=key,order2){if(typeof val==="undefined")return;else{const hasPrevious=prevKey!==void 0&&Object.prototype.hasOwnProperty.call(object2,prevKey);const prev=hasPrevious?object2[prevKey]:void 0;const index=Array.isArray(prev)?prev.length:hasPrevious?1:0;if(Array.isArray(prev))prev.push(val);else if(hasPrevious)setObjectValue(object2,prevKey,[prev,val]);else setObjectValue(object2,key,val);order2?.push([hasPrevious?prevKey:key,index])}function setObjectValue(object3,key2,value){Object.defineProperty(object3,key2,{configurable:true,enumerable:true,value,writable:true})}}}function unescapeXML(str){return str.replace(/(&(?:lt|gt|amp|apos|quot|#(?:\d{1,7}|x[0-9a-fA-F]{1,6}));)/g,str2=>{if(str2[1]==="#"){const code=str2[2]==="x"?Number.parseInt(str2.substr(3),16):Number.parseInt(str2.substr(2),10);if(code>=0&&code<=1114111&&!(code>=55296&&code<=57343))return String.fromCodePoint(code)}return UNESCAPE[str2]||str2})}}static stringify(json=new Object,tab=""){const ESCAPE=this.#ESCAPE;const ATTRIBUTE_KEY=this.#ATTRIBUTE_KEY;const CHILD_NODE_KEY=this.#CHILD_NODE_KEY;let XML2="";for(const[name,value]of getChildren(json))XML2+=toXml(value,name,"");return XML2;function*getChildren(Elem){const emitted=new Map;for(const[name,index]of Elem[XML_ORDER]??[]){if(!Object.prototype.hasOwnProperty.call(Elem,name))continue;const value=Elem[name];if(Array.isArray(value)){if(index<value.length)yield[name,value[index]]}else if(index===0)yield[name,value];emitted.set(name,index+1)}for(const name of Object.keys(Elem)){if(name[0]===ATTRIBUTE_KEY)continue;const values=Array.isArray(Elem[name])?Elem[name]:[Elem[name]];for(let index=emitted.get(name)??0;index<values.length;index++)yield[name,values[index]]}}function toXml(Elem,Name,Ind){if(Name===CHILD_NODE_KEY)return escapeXML(Elem??"");let xml="";switch(typeof Elem){case"object":if(Array.isArray(Elem)){xml=Elem.map(value=>toXml(value,Name,Ind)).join(tab?"\n":"")}else{let attribute="";let hasChild=false;for(const name of Object.keys(Elem)){if(name[0]===ATTRIBUTE_KEY){attribute+=Elem[name]===null?` ${name.substring(1)}`:` ${name.substring(1)}="${escapeXML(Elem[name]??"")}"`}else if(Elem[name]===void 0)Name=name;else hasChild=true}xml+=`${Ind}<${Name}${attribute}${hasChild?"":"/"}>`;if(hasChild){const formatted=tab&&!Object.prototype.hasOwnProperty.call(Elem,CHILD_NODE_KEY)&&!Object.prototype.hasOwnProperty.call(Elem,"!CDATA");const childIndent=formatted?Ind+tab:"";const children=Name==="plist"?toPlist(Elem,Name,childIndent):Array.from(getChildren(Elem),([name,value])=>toXml(value,name,childIndent)).join(formatted?"\n":"");xml+=`${formatted&&children?"\n":""}${children}${formatted&&children?`
${Ind}`:""}</${Name}>`}}break;case"string":switch(Name){case"?xml":xml+=`${Ind}<${Name} ${Elem.toString()}>`;break;case"?":xml+=`${Ind}<${Name}${Elem.toString()}${Name}>`;break;case"!--":xml+=`${Ind}<!--${Elem.toString()}-->`;break;case"!DOCTYPE":xml+=`${Ind}<${Name} ${Elem.toString()}>`;break;case"!CDATA":xml+=`${Ind}<![CDATA[${Elem.toString()}]]>`;break;default:xml+=`${Ind}<${Name}>${escapeXML(Elem)}</${Name}>`;break}break;case"undefined":xml+=Ind+`<${Name.toString()}/>`;break}return xml}function toPlist(Elem,Name,Ind){let plist="";switch(typeof Elem){case"boolean":plist=`${Ind}<${Elem.toString()}/>`;break;case"number":plist=`${Ind}<real>${Elem.toString()}</real>`;break;case"bigint":plist=`${Ind}<integer>${Elem.toString()}</integer>`;break;case"string":plist=`${Ind}<string>${escapeXML(Elem)}</string>`;break;case"object":{const childIndent=Ind+tab;const separator=tab?"\n":"";let content,tag;if(Array.isArray(Elem)){content=Elem.map(value=>toPlist(value,Name,childIndent)).join(separator);tag="array"}else{content=Object.entries(Elem).flatMap(([key,value])=>[`${childIndent}<key>${escapeXML(key)}</key>`,toPlist(value,key,childIndent)]).join(separator);tag="dict"}plist=`${Ind}<${tag}>${content?`${separator}${content}${separator}${Ind}`:""}</${tag}>`;break}}return plist}function escapeXML(value){return String(value).replace(/[&<>"']/g,character=>ESCAPE[character])}}};var WebVTT=class{static name="WebVTT";static version="2.2.0";static about=()=>console.log(`
\u{1F7E7} ${this.name} v${this.version}
`);static parse(vtt=new String,options={milliseconds:true,timeStamp:true,line:"single",lineBreak:"\n"}){const WebVTTCueRegex=options.milliseconds?/^((?<index>\d+)(\r\n|\r|\n))?(?<timing>(?<startTime>[0-9:.,]+) --> (?<endTime>[0-9:.,]+)) ?(?<settings>.+)?[^](?<text>[\s\S]*)?$/:/^((?<index>\d+)(\r\n|\r|\n))?(?<timing>(?<startTime>[0-9:]+)[0-9.,]+ --> (?<endTime>[0-9:]+)[0-9.,]+) ?(?<settings>.+)?[^](?<text>[\s\S]*)?$/;const Array2=vtt.split(/\r\n\r\n|\r\r|\n\n/);const Json={headers:{},comments:[],style:"",body:[]};Array2.forEach(item=>{item=item.trim();switch(item.substring(0,5).trim()){case"WEBVT":{let cues=item.split(/\r\n|\r|\n/);Json.headers.type=cues.shift();Json.headers.options=cues;break};case"NOTE":{Json.comments.push(item);break};case"STYLE":{let cues=item.split(/\r\n|\r|\n/);cues.shift();Json.style=cues.join(options.lineBreak);break};default:let cue=item.match(WebVTTCueRegex)?.groups;if(cue){if(Json.headers?.type!=="WEBVTT"){cue.timing=cue?.timing?.replace?.(",",".");cue.startTime=cue?.startTime?.replace?.(",",".");cue.endTime=cue?.endTime?.replace?.(",",".")}if(options.timeStamp){let ISOString=cue?.startTime?.replace?.(/(.*)/,"1970-01-01T$1Z");cue.timeStamp=options.milliseconds?Date.parse(ISOString):Date.parse(ISOString)/1e3}cue.text=cue?.text?.trimEnd?.();switch(options.line){case"single":cue.text=cue?.text?.replace?.(/\r\n|\r|\n/," ");break;case"multi":cue.text=cue?.text?.split?.(/\r\n|\r|\n/);break};Json.body.push(cue)};break}});return Json}static stringify(json={headers:{},comments:[],style:"",body:[]},options={milliseconds:true,timeStamp:true,line:"single",lineBreak:"\n"}){let vtt=[json.headers=[json.headers?.type||"",json.headers?.options||""].flat(Infinity).join(options.lineBreak),json.comments=json?.comments?.join?.(options.lineBreak),json.style=json?.style?.length>0?["STYLE",json.style].join(options.lineBreak):"",json.body=json.body.map(item=>{if(Array.isArray(item.text))item.text=item.text.join(options.lineBreak);item=`${item.index?item.index+options.lineBreak:""}${item.timing} ${item?.settings??""}${options.lineBreak}${item.text}`;return item}).join(options.lineBreak+options.lineBreak)].join(options.lineBreak+options.lineBreak).trim()+options.lineBreak+options.lineBreak;return vtt}};return __toCommonJS(stdin_exports);})();

function __fullParam(name,fallback){try{const v=Anywhere.params.get(name);return v===undefined||v===null||v===''?fallback:String(v);}catch(error){return fallback;}}
function __fullQuery(url,key){const head=String(url).split('#')[0],at=head.indexOf('?'),query=at<0?'':head.slice(at+1);for(const item of query.split('&')){const eq=item.indexOf('='),name=eq<0?item:item.slice(0,eq);try{if(decodeURIComponent(name)===key)return decodeURIComponent((eq<0?'':item.slice(eq+1)).replace(/\+/g,' '));}catch(error){}}return '';}
function __fullSetQuery(url,key,value){const [head,fragment]=String(url).split('#'),at=head.indexOf('?'),base=at<0?head:head.slice(0,at),query=at<0?'':head.slice(at+1);const parts=query.split('&').filter(x=>{if(!x)return false;try{return decodeURIComponent(x.split('=')[0])!==key;}catch(error){return true;}});if(value!==null)parts.push(encodeURIComponent(key)+'='+encodeURIComponent(value));return base+(parts.length?'?'+parts.join('&'):'')+(fragment===undefined?'':'#'+fragment);}
async function __fullSubtitleRequest(ctx,suppliedPrimary){
 if((suppliedPrimary?ctx.phase!=='response':ctx.phase!=='request')||!/^https?:\/\/(?:www|m)\.youtube\.com\/api\/timedtext(?:\?|$)/.test(ctx.url||'')||!['GET','HEAD'].includes(ctx.method||'GET'))return;
 if(String(ctx.method)==='HEAD')return;
 const type=__fullParam('subtitle_type','Translate');__fullCaptionDiagnostic(ctx,suppliedPrimary?'official-start':'request','type='+type);if(type==='Translate'||(type==='Official'&&!suppliedPrimary))return;
 const target=__fullQuery(ctx.originalUrl||ctx.url,'tlang')||__fullParam('subtitle_target_language','zh-CN');
 const original=String(ctx.originalUrl||ctx.url),sourceURL=__fullSetQuery(__fullSetQuery(original,'tlang',null),'subtype',null);
 const primaryURL=suppliedPrimary?sourceURL:type!=='Official'?sourceURL:__fullSetQuery(original,'tlang',target);
 const allowed=new Set(['user-agent','accept','accept-language','authorization','cookie','referer']);const headers=Object.fromEntries((ctx.headers||[]).filter(h=>allowed.has(String(h[0]).toLowerCase())));
 let primary;
 try{primary=suppliedPrimary||await __DualSubsCore.fetch({url:primaryURL,headers});}catch(error){__fullCaptionDiagnostic(ctx,'official','state=source-fetch-failed');return;}
 const view={phase:'response',status:primary.status,url:primaryURL,originalUrl:original,headers:Object.entries(primary.headers),body:Anywhere.codec.utf8.encode(primary.body)};
 try{
  if(suppliedPrimary||type==='External'||__fullParam('show_only_auto_translation','false')!=='true'){
   const secondaryURL=suppliedPrimary?__fullSetQuery(sourceURL,'tlang',target):type==='External'?__fullParam('external_subtitle_url',''):sourceURL;
   if(!/^https?:\/\//.test(secondaryURL))throw Error('Missing secondary subtitle URL');
   const secondary=await __DualSubsCore.fetch({url:secondaryURL,headers:type==='External'?{}:headers});
   if(!secondary.body.trim())throw Error('YT:empty-secondary');
   if(suppliedPrimary&&__fullParam('show_only_auto_translation','false')==='true'){ctx.body=Anywhere.codec.utf8.encode(secondary.body);__fullCaptionDiagnostic(ctx,'official','state=translated-only');return;}
   const fmt=__fullQuery(original,'fmt')||__fullQuery(original,'format'),mime=(primary.headers['content-type']||primary.headers['Content-Type']||'').split(';')[0];
   const options={Position:type==='Official'&&!suppliedPrimary?(__fullParam('subtitle_position','Forward')==='Reverse'?'Forward':'Reverse'):__fullParam('subtitle_position','Forward'),Tolerance:Math.max(0,Math.min(5000,Number(__fullParam('subtitle_tolerance_ms','100'))||0))};
   const offset=Math.max(-60000,Math.min(60000,Number(__fullParam('subtitle_offset_ms','0'))||0));const compose=new __DualSubsCore.Composite(options);let output;
   if(/json/i.test(mime)||fmt==='json3'){
    const first=JSON.parse(primary.body),second=JSON.parse(secondary.body);for(const event of second.events||[])if(typeof event.tStartMs==='number')event.tStartMs+=offset;
    output=JSON.stringify(compose.JSON(first,second,__fullQuery(original,'kind')||'captions'));
   }else if(/vtt/i.test(mime)||fmt==='vtt'){
    const first=__DualSubsFormats.VTT.parse(primary.body),second=__DualSubsFormats.VTT.parse(secondary.body);for(const cue of second.body||[])if(typeof cue.timeStamp==='number')cue.timeStamp+=offset;
    output=__DualSubsFormats.VTT.stringify(compose.webVTT(first,second));
   }else if(/xml/i.test(mime)||fmt==='srv3'){
    const first=__DualSubsFormats.XML.parse(primary.body),second=__DualSubsFormats.XML.parse(secondary.body);for(const item of [first,second]){if(item?.timedtext?.body?.p&&!Array.isArray(item.timedtext.body.p))item.timedtext.body.p=[item.timedtext.body.p];for(const p of item?.timedtext?.body?.p||[])if(p.s){p['#']=(Array.isArray(p.s)?p.s:[p.s]).map(seg=>seg['#']||'').join('');delete p.s;}}for(const paragraph of second?.timedtext?.body?.p||[])paragraph['@t']=String(Number(paragraph['@t'])+offset);
    const composed=compose.timedText(first,second,'captions');if(__fullQuery(original,'kind')==='asr'&&Array.isArray(composed?.timedtext?.head?.wp)&&composed.timedtext.head.wp[1]?.['@rc'])composed.timedtext.head.wp[1]['@rc']='1';output=__DualSubsFormats.XML.stringify(composed);
   }
   if(output)view.body=Anywhere.codec.utf8.encode(output);
   if(suppliedPrimary)__fullCaptionDiagnostic(ctx,'official','state='+(output&&output!==primary.body?'composed':'no-aligned-output'));
  }
 }catch(error){/* Keep the complete primary track on secondary failure. */if(suppliedPrimary){const http=String(error).match(/HTTP (\d{3})/),code=String(error).match(/YT:([a-z-]+)/);__fullCaptionDiagnostic(ctx,'official','state=secondary-failed failure='+(http?'http-'+http[1]:code?code[1]:error?.name==='SyntaxError'?'json-parse':'composition-error'));}}
 const responseHeaders=Object.entries(primary.headers).filter(([name])=>! /^(?:content-length|content-encoding|transfer-encoding|connection|host)$/i.test(name));
 if(suppliedPrimary){ctx.body=view.body;return;}
 Anywhere.respond({status:primary.status,headers:responseHeaders,body:view.body});
}

async function process(ctx){await __fullSubtitleRequest(ctx)}


// Loon entry for request
(async () => {
  try {
    const ctx = __buildCtx("request");
    if (typeof process === "function") {
      await process(ctx);
    }
    // if script modified ctx but did not call respond, pass through
    if (ctx.body) {
      let body = ctx.body;
      if (body instanceof Uint8Array) body = Anywhere.codec.utf8.decode(body);
      $done({ body });
    } else {
      $done({});
    }
  } catch (e) {
    console.log("[YT-timedtext-req] error: " + e);
    $done({});
  }
})();
