/**
 * 中国联通话费流量小组件 - Egern 玻璃卡片重设计版
 * 保留：自动捕获 Cookie/手机号、话费/语音/流量查询、通用/定向流量筛选、缓存、过期提醒、保活。
 * 用法：http_request 自动捕获；generic 显示组件；schedule / CU_KEEPALIVE 保活。
 */

const API_HOST = 'm.client.10010.com';
const API_URL = 'https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven';
const FLOW_DETAIL_URL = 'https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune';

const COLORS = {
  bg: { light: '#F5F5FA', dark: '#202024' },
  border: { light: '#FFFFFFCC', dark: '#FFFFFF1A' },
  title: { light: '#7C8190', dark: '#A5A5B0' },
  value: { light: '#171923', dark: '#F8F8FC' },
  time: { light: '#9296A3', dark: '#8D8D98' },
  error: { light: '#E60012', dark: '#FF5364' },
  capsuleBg: { light: '#FFFFFFB8', dark: '#FFFFFF0D' },
  accent: { light: '#E60012', dark: '#FF5268' },
  pink: { light: '#F45A91', dark: '#FF78A7' },
  green: { light: '#20B879', dark: '#43D69B' },
  orange: { light: '#F5A33A', dark: '#FFB454' },
  blue: { light: '#6599F6', dark: '#83ACFF' },
};

/* ---------------- Cookie / 手机号自动捕获 ---------------- */
function getRequestHeader(headers, name) {
  if (!headers) return '';
  try {
    if (typeof headers.get === 'function') return headers.get(name) || '';
  } catch (_) {}
  try {
    for (const key of Object.keys(headers)) {
      if (String(key).toLowerCase() === name.toLowerCase()) return headers[key] || '';
    }
  } catch (_) {}
  return '';
}

function extractPhone(url) {
  if (!url) return '';
  try {
    const match = String(url).match(/[?&]desmobiel=([^&]+)/i);
    if (match && match[1]) return decodeURIComponent(match[1]).trim();
  } catch (_) {}
  return '';
}

async function handleCapture(ctx) {
  const req = ctx.request || {};
  const url = String(req.url || '');
  if (!url || !url.includes(API_HOST)) return;

  const cookie = String(getRequestHeader(req.headers, 'cookie') || '').trim();
  const phone = extractPhone(url);
  let changed = false;

  if (cookie) {
    const oldCookie = ctx.storage.get('unicom_cookie') || '';
    if (cookie !== oldCookie) {
      ctx.storage.set('unicom_cookie', cookie);
      changed = true;
    }
  }
  if (phone) {
    const oldPhone = ctx.storage.get('unicom_phone') || '';
    if (phone !== oldPhone) {
      ctx.storage.set('unicom_phone', phone);
      changed = true;
    }
  }
  if (changed && cookie && phone) {
    ctx.notify({ title: '中国联通', body: '已自动获取登录信息，小组件将自动更新' });
  }
}

/* ---------------- 网络请求 ---------------- */
async function fetchUnicomData(ctx, cookie, phone) {
  const url = `${API_URL}?version=iphone_c@10.0100&desmobiel=${encodeURIComponent(phone)}&showType=0`;
  const resp = await ctx.http.get(url, {
    timeout: 10000,
    headers: {
      Host: API_HOST,
      'User-Agent': 'ChinaUnicom.x CFNetwork iOS/16.3',
      Cookie: cookie,
    },
    credentials: 'omit',
  }).catch(e => { e.transient = true; throw e; });

  if (!resp) {
    const e = new Error('no-response'); e.transient = true; throw e;
  }
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error(`HTTP ${resp.status}`); e.authFailed = true; throw e;
  }
  if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
  return await resp.json();
}

async function fetchFlowDetail(ctx, cookie) {
  const resp = await ctx.http.post(FLOW_DETAIL_URL, {
    timeout: 10000,
    headers: {
      Host: API_HOST,
      'User-Agent': 'ChinaUnicom.x CFNetwork iOS/16.3',
      Cookie: cookie,
    },
    credentials: 'omit',
  });
  if (!resp || resp.status !== 200) throw new Error(`HTTP ${resp ? resp.status : 'no-response'}`);
  const data = await resp.json();
  if (!data || String(data.code) !== '0000') throw new Error(`API 返回异常：${data?.code || 'unknown'}`);
  return data;
}

const FLOW_RESOURCE_NAMES = {
  resources: '套餐内流量&流量包',
  unshared: '套餐内流量&流量包(非共享)',
  rzbresources: '日租宝',
  mlresources: '免流流量',
  twresources: '套外流量',
};

function isDirectionalFlowItem(item, resourceName) {
  const code = String(item.addupItemCode || '');
  const name = String(item.addUpItemName || '');
  const policy = String(item.feePolicyName || '');
  return code === '40008' || name === '套餐内专享免费流量' || resourceName === '免流流量' || /（免流）|畅视/.test(policy);
}

function formatFlowValue(value, unit) {
  const v = parseFloat(value) || 0;
  const u = String(unit || '').toUpperCase();
  if ((u === 'MB' || u === 'M') && v >= 1024) {
    return { value: Math.round(v / 1024 * 100) / 100, unit: 'GB' };
  }
  return { value: Math.round(v * 100) / 100, unit: String(unit || 'MB') };
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatGBFromMB(value) {
  return round2((Number(value) || 0) / 1024);
}

function getUsagePercent(used, total) {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
}

// 汇总流量明细，单位按原脚本约定为 MB。
function parseFlowDetail(data) {
  let generalRemain = 0, directionalRemain = 0;
  let generalTotal = 0, directionalTotal = 0;
  let generalUsed = 0, directionalUsed = 0;

  for (const key of Object.keys(FLOW_RESOURCE_NAMES)) {
    const resourceName = FLOW_RESOURCE_NAMES[key];
    const list = data[key];
    if (!Array.isArray(list)) continue;
    for (const res of list) {
      if (!Array.isArray(res.details)) continue;
      for (const item of res.details) {
        const directional = isDirectionalFlowItem(item, resourceName);
        const remain = Math.max(0, parseFloat(item.remain) || 0);
        const total = Math.max(0, parseFloat(item.total) || 0);
        const used = Math.max(0, parseFloat(item.use) || 0);
        if (directional) {
          directionalRemain += remain;
          directionalTotal += total;
          directionalUsed += used;
        } else {
          generalRemain += remain;
          generalTotal += total;
          generalUsed += used;
        }
      }
    }
  }
  return { generalRemain, directionalRemain, generalTotal, directionalTotal, generalUsed, directionalUsed };
}

/* ---------------- 汇总接口数据解析 ---------------- */
function parseUnicomData(res) {
  if (!res || res.code !== 'Y' || !res.feeResource || !res.voiceResource || !res.flowResource) {
    throw new Error(`API 返回异常：${res?.code || 'unknown'}`);
  }
  const fee = res.feeResource;
  const voice = res.voiceResource;
  const flow = res.flowResource;
  const formatted = formatFlowValue(flow.flowPersent ?? 0, flow.newUnit || 'MB');

  return {
    fee: {
      title: fee.dynamicFeeTitle || '剩余话费',
      value: fee.feePersent ?? 0,
      unit: fee.newUnit || '元',
    },
    voice: {
      title: voice.dynamicVoiceTitle || '剩余语音',
      value: voice.voicePersent ?? 0,
      unit: voice.newUnit || '分钟',
    },
    flow: {
      title: flow.dynamicFlowTitle || '剩余流量',
      value: formatted.value,
      unit: formatted.unit,
    },
    updateTime: new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai',
    }),
    timestamp: Date.now(),
  };
}

/* ---------------- 数据加载 / 缓存 ---------------- */
function notifyExpiredOnce(ctx, cookie) {
  const key = 'unicom_expired_notified';
  const marker = cookie || 'none';
  if (ctx.storage.get(key) === marker) return;
  ctx.storage.set(key, marker);
  try {
    ctx.notify({ title: '中国联通', body: '登录已过期，请重新打开联通 App 获取登录信息' });
  } catch (_) {}
}

function clearExpiredFlag(ctx) {
  try { ctx.storage.remove('unicom_expired_notified'); } catch (_) {}
}

async function loadData(ctx) {
  const cookie = ctx.storage.get('unicom_cookie') || '';
  const phone = ctx.storage.get('unicom_phone') || '';
  if (!cookie || !phone) return { data: null, configured: false, error: null };

  try {
    const res = await fetchUnicomData(ctx, cookie, phone);
    const data = parseUnicomData(res);
    const showGeneralFlow = ctx.env.CU_SHOW_GENERAL_FLOW !== 'false';
    const showDirectionalFlow = ctx.env.CU_SHOW_DIRECTIONAL_FLOW !== 'false';

    // 明细接口失败时保留汇总接口原始剩余量，不影响话费和语音。
    try {
      const detail = await fetchFlowDetail(ctx, cookie);
      const parsed = parseFlowDetail(detail);
      let flowRemain = 0, flowTotal = 0, flowUsed = 0;
      if (showGeneralFlow) {
        flowRemain += parsed.generalRemain;
        flowTotal += parsed.generalTotal;
        flowUsed += parsed.generalUsed;
      }
      if (showDirectionalFlow) {
        flowRemain += parsed.directionalRemain;
        flowTotal += parsed.directionalTotal;
        flowUsed += parsed.directionalUsed;
      }
      const formatted = formatFlowValue(flowRemain, 'MB');
      data.flow.value = formatted.value;
      data.flow.unit = formatted.unit;
      data.flow.remainMB = flowRemain;
      data.flow.totalMB = flowTotal;
      data.flow.usedMB = flowUsed;
      data.flow.usedPercent = flowTotal > 0 ? getUsagePercent(flowUsed, flowTotal) : null;
    } catch (_) {
      // 详情接口异常时，UI 会显示“明细暂不可用”，不会伪造总量/使用率。
    }

    ctx.storage.setJSON('unicom_datasource', data);
    clearExpiredFlag(ctx);
    return { data, configured: true, error: null };
  } catch (e) {
    if (e && e.authFailed) notifyExpiredOnce(ctx, cookie);
    const cached = ctx.storage.getJSON('unicom_datasource');
    return { data: cached || null, configured: true, error: e };
  }
}

/* ---------------- Egern 组件 UI 帮助函数 ---------------- */
function headerRow(title, data, fromCache) {
  return {
    type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
    children: [
      { type: 'image', src: 'sf-symbol:antenna.radiowaves.left.and.right', color: COLORS.accent, width: 18, height: 18 },
      { type: 'text', text: title, font: { size: 'headline', weight: 'bold' }, textColor: COLORS.value, maxLines: 1, minScale: 0.8 },
      { type: 'spacer' },
      { type: 'text', text: `${fromCache ? '缓存' : '更新'} ${data?.updateTime || '--:--'}`, font: { size: 'caption2' }, textColor: COLORS.time, maxLines: 1 },
    ],
  };
}

function textNode(text, size, color, weight) {
  return { type: 'text', text: String(text), font: { size, weight: weight || 'regular' }, textColor: color, maxLines: 1, minScale: 0.5 };
}

function iconNode(symbol, color, width = 17, height = 17) {
  return { type: 'image', src: `sf-symbol:${symbol}`, color, width, height };
}

function panel(children, options = {}) {
  return {
    type: 'stack', direction: options.direction || 'column',
    alignItems: options.alignItems || 'stretch',
    justifyContent: options.justifyContent || 'center',
    flex: options.flex === undefined ? 1 : options.flex,
    padding: options.padding || [9, 10, 9, 10],
    gap: options.gap === undefined ? 4 : options.gap,
    backgroundColor: { light: options.light || '#FFFFFFC9', dark: options.dark || '#FFFFFF0D' },
    borderRadius: options.radius || 18, borderWidth: 1, borderColor: COLORS.border,
    children,
  };
}

function buildMainWidget(title, data, fromCache) {
  const fee = data.fee || {};
  const voice = data.voice || {};
  const flow = data.flow || {};
  const value = Number(flow.value) || 0;
  const unit = flow.unit || 'MB';
  const totalMB = Number(flow.totalMB) || 0;
  const usedMB = Number(flow.usedMB) || 0;
  const remainMB = Number(flow.remainMB);
  const hasDetail = totalMB > 0;
  const usedPercent = hasDetail ? getUsagePercent(usedMB, totalMB) : null;
  const remainingPercent = hasDetail ? 100 - usedPercent : null;
  const remainingText = `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`;

  const leftPanel = panel([
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, children: [iconNode('chart.pie.fill', COLORS.pink), textNode('流量主卡', 'headline', COLORS.value, 'semibold')] },
    { type: 'spacer' },
    { type: 'stack', alignItems: 'center', justifyContent: 'center', gap: 5, children: [
      iconNode('gauge', COLORS.pink, 54, 54),
      textNode(hasDetail ? `${usedPercent}% 已用` : '流量余量', 'title2', COLORS.pink, 'bold'),
      textNode('流量使用率', 'caption2', COLORS.title),
    ] },
    { type: 'spacer' },
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [iconNode('chart.xyaxis.line', COLORS.pink, 14, 14), textNode('流量趋势', 'caption2', COLORS.title)] },
  ], { flex: 0.92, padding: [10, 10, 10, 10], gap: 4, radius: 22 });

  const centerPanel = {
    type: 'stack', direction: 'column', alignItems: 'start', justifyContent: 'center', flex: 1.35,
    padding: [4, 4, 4, 4], gap: 7,
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [iconNode('checkmark.circle.fill', COLORS.green, 13, 13), textNode(hasDetail ? `${remainingPercent}% 剩余` : '当前剩余流量', 'subheadline', COLORS.green, 'semibold')] },
      { type: 'text', text: remainingText, font: { size: 'largeTitle', weight: 'bold' }, textColor: COLORS.value, maxLines: 1, minScale: 0.38 },
      textNode(hasDetail ? `已用 ${formatGBFromMB(usedMB)} GB` : '已用量：明细暂不可用', 'subheadline', COLORS.title),
      textNode(hasDetail ? `套餐 ${formatGBFromMB(totalMB)} GB` : '套餐总量：明细暂不可用', 'subheadline', COLORS.title),
      { type: 'spacer' },
      textNode(hasDetail ? `剩余 ${round2(remainMB / 1024)} GB` : '数据来自中国联通接口', 'caption2', COLORS.time),
    ],
  };

  const feePanel = panel([
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 7, children: [
      { type: 'stack', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, backgroundColor: { light: '#FFF0D9', dark: '#F5A33A22' }, borderRadius: 16, children: [iconNode('yensign', COLORS.orange, 15, 15)] },
      textNode('话费', 'subheadline', COLORS.title),
    ] },
    textNode(`${fee.value ?? '--'} ${fee.unit || '元'}`, 'title2', COLORS.value, 'bold'),
  ], { padding: [8, 9, 8, 9], gap: 5, radius: 18 });

  const voicePanel = panel([
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 7, children: [
      { type: 'stack', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, backgroundColor: { light: '#DFF8EC', dark: '#20B87922' }, borderRadius: 16, children: [iconNode('phone.fill', COLORS.green, 15, 15)] },
      textNode('语音', 'subheadline', COLORS.title),
    ] },
    textNode(`${voice.value ?? '--'} ${voice.unit || '分钟'}`, 'title2', COLORS.value, 'bold'),
  ], { padding: [8, 9, 8, 9], gap: 5, radius: 18 });

  const rightPanel = {
    type: 'stack', direction: 'column', alignItems: 'stretch', justifyContent: 'center', flex: 0.94, gap: 8,
    children: [feePanel, voicePanel, {
      type: 'stack', direction: 'row', alignItems: 'center', justifyContent: 'center', padding: [5, 6, 5, 6],
      backgroundColor: { light: '#E7F8F0', dark: '#20B87920' }, borderRadius: 15,
      children: [textNode(hasDetail ? `${usedPercent}% 已用` : '流量详情', 'subheadline', COLORS.green, 'semibold')],
    }],
  };

  return {
    type: 'widget', padding: [10, 12, 10, 12], gap: 8,
    backgroundColor: COLORS.bg,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [headerRow(title, data, fromCache), {
      type: 'stack', direction: 'row', alignItems: 'stretch', gap: 8, flex: 1,
      children: [leftPanel, centerPanel, rightPanel],
    }],
  };
}

/* ---------------- 小尺寸组件 ---------------- */
function smallRow(color, symbol, glyph, value, unit, label) {
  const icon = symbol
    ? iconNode(symbol, '#FFFFFF', 15, 15)
    : { type: 'text', text: glyph, font: { size: 'headline', weight: 'bold' }, textColor: '#FFFFFF' };
  return {
    type: 'stack', direction: 'row', alignItems: 'center', gap: 8, flex: 1,
    padding: [4, 8, 4, 8],
    backgroundColor: { light: `${color}20`, dark: `${color}25` }, borderRadius: 14,
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 15, backgroundColor: { light: color, dark: `${color}80` }, children: [icon] },
      { type: 'stack', direction: 'column', flex: 1, children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 3, children: [
          { type: 'text', text: String(value), font: { size: 'title3', weight: 'bold' }, textColor: color, maxLines: 1, minScale: 0.5 },
          { type: 'text', text: String(unit), font: { size: 'caption1', weight: 'semibold' }, textColor: color, maxLines: 1 },
          { type: 'spacer' },
        ] },
        { type: 'text', text: String(label), font: { size: 'caption2', weight: 'medium' }, textColor: color, maxLines: 1, minScale: 0.65 },
      ] },
    ],
  };
}

function buildSmall(title, data, fromCache) {
  return {
    type: 'widget', padding: [10, 10, 10, 10], gap: 6,
    backgroundColor: COLORS.bg,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      headerRow(title, data, fromCache),
      smallRow('#F5A33A', null, '¥', data.fee.value, data.fee.unit, data.fee.title),
      smallRow('#6599F6', 'antenna.radiowaves.left.and.right', '', data.flow.value, data.flow.unit, data.flow.title),
      smallRow('#20B879', 'phone.fill', '', data.voice.value, data.voice.unit, data.voice.title),
    ],
  };
}

/* ---------------- 锁屏组件 ---------------- */
function buildLockScreen(title, data, family) {
  const sub = { light: '#FFFFFFB3', dark: '#FFFFFFB3' };
  if (family === 'accessoryInline') {
    return { type: 'widget', children: [{ type: 'text', text: `${title} ${data.fee.value}${data.fee.unit} · ${data.flow.value}${data.flow.unit}`, font: { size: 'caption1', weight: 'medium' }, maxLines: 1, minScale: 0.5 }] };
  }
  if (family === 'accessoryCircular') {
    return { type: 'widget', padding: 2, children: [
      { type: 'spacer' },
      { type: 'text', text: String(data.flow.value), font: { size: 'headline', weight: 'bold' }, textAlign: 'center', maxLines: 1, minScale: 0.5 },
      { type: 'text', text: data.flow.unit, font: { size: 'caption2' }, textColor: sub, textAlign: 'center', maxLines: 1 },
      { type: 'spacer' },
    ] };
  }
  const line = (label, value, unit) => ({ type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [
    { type: 'text', text: label, font: { size: 'caption2', weight: 'medium' }, textColor: sub, maxLines: 1 },
    { type: 'spacer' },
    { type: 'text', text: String(value), font: { size: 'caption1', weight: 'bold' }, maxLines: 1, minScale: 0.6 },
    { type: 'text', text: String(unit), font: { size: 'caption2' }, textColor: sub, maxLines: 1 },
  ] });
  return { type: 'widget', padding: 2, gap: 2, children: [line('话费', data.fee.value, data.fee.unit), line('流量', data.flow.value, data.flow.unit), line('语音', data.voice.value, data.voice.unit)] };
}

/* ---------------- 错误提示 ---------------- */
function buildError(title, message) {
  return {
    type: 'widget', padding: 12, gap: 8, backgroundColor: COLORS.bg,
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [iconNode('exclamationmark.triangle.fill', COLORS.error, 15, 15), { type: 'text', text: title, font: { size: 'headline', weight: 'semibold' }, textColor: COLORS.value, maxLines: 1 }] },
      { type: 'spacer' },
      { type: 'text', text: message, font: { size: 'caption1', weight: 'medium' }, textColor: COLORS.title, textAlign: 'center', maxLines: 3, minScale: 0.75 },
      { type: 'spacer' },
      { type: 'stack', direction: 'row', alignItems: 'center', justifyContent: 'center', padding: [6, 10, 6, 10], backgroundColor: COLORS.capsuleBg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, children: [{ type: 'text', text: '打开联通 App 查询一次', font: { size: 'caption2', weight: 'medium' }, textColor: COLORS.accent, maxLines: 1 }] },
    ],
  };
}

/* ---------------- Widget 主逻辑 ---------------- */
async function handleWidget(ctx) {
  const title = '中国联通';
  const result = await loadData(ctx);
  const data = result.data;
  if (!result.configured) return buildError(title, '请打开联通 App，进入首页并点击余额位置');
  if (!data) return buildError(title, '数据获取失败，请重新打开联通 App 查询一次');

  const family = ctx.widgetFamily || 'systemSmall';
  if (family.startsWith('accessory')) return buildLockScreen(title, data, family);
  if (family === 'systemSmall') return buildSmall(title, data, false);
  if (family === 'systemMedium' || family === 'systemLarge' || family === 'systemExtraLarge') {
    return buildMainWidget(title, data, false);
  }
  return buildSmall(title, data, false);
}

/* ---------------- 保活模式 ---------------- */
async function handleKeepAlive(ctx) {
  const cookie = ctx.storage.get('unicom_cookie') || '';
  const phone = ctx.storage.get('unicom_phone') || '';
  if (!cookie || !phone) return;
  try { await fetchUnicomData(ctx, cookie, phone); } catch (_) {}
}

/* ---------------- Egern 入口 ---------------- */
export default async function(ctx) {
  if (ctx.request && ctx.request.url) return handleCapture(ctx);
  if (ctx.cron || (ctx.env && ctx.env.CU_KEEPALIVE === 'true')) return handleKeepAlive(ctx);
  return handleWidget(ctx);
}
