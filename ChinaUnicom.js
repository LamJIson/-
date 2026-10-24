/**
 * 中国联通话费流量小组件（玻璃拟态风格）
 *
 * 自动获取方式：
 * 1. 打开中国联通 App
 * 2. 进入首页
 * 3. 点击当前余额 / 话费位置，让 App 查询一次
 * 4. Egern 会自动捕获联通 App 请求中的 Cookie 和手机号
 * 5. 小组件自动使用捕获的数据，无需手动填写环境变量
 *
 * 自动捕获域名：m.client.10010.com
 *
 * 数据接口：
 * https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven
 *
 * 流量明细：
 * POST https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune
 *
 * 同一脚本三种入口：
 * http_request → 自动抓 Cookie / 手机号
 * generic      → 显示 Widget
 * schedule     → 保活（ctx.cron 或 Env CU_KEEPALIVE=true）
 *
 * 可选环境变量：
 * CU_SHOW_GENERAL_FLOW=true/false
 * CU_SHOW_DIRECTIONAL_FLOW=true/false
 * CU_KEEPALIVE=true
 */

const API_HOST = 'm.client.10010.com';
const API_URL =
  'https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven';
const FLOW_DETAIL_URL =
  'https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune';

const COLORS = {
  bg: { light: '#F5F5F7', dark: '#1C1C1E' },
  card: { light: '#FFFFFF', dark: '#2C2C2E' },
  border: { light: '#E5E5EA', dark: '#3A3A3C' },
  title: { light: '#8E8E93', dark: '#98989D' },
  subtitle: { light: '#8E8E93', dark: '#98989D' },
  value: { light: '#1C1C1E', dark: '#FFFFFF' },
  time: { light: '#999999', dark: '#666666' },
  accent: { light: '#E60012', dark: '#FF375F' },
  softPink: { light: '#FF6B8A', dark: '#FF6B8A' },
  pink: { light: '#FF6B8A', dark: '#FF6B8A' },
  green: { light: '#34C759', dark: '#30D158' },
  orange: { light: '#FF9500', dark: '#FF9F0A' },
  fee: { light: '#FF9500', dark: '#FF9F0A' },
  voice: { light: '#34C759', dark: '#30D158' },
  error: { light: '#FF3B30', dark: '#FF453A' },
  capsuleBg: { light: '#F2F2F7', dark: '#3A3A3C' },
  badgeBg: { light: '#FFE5EC', dark: '#3A1F2A' },
  badgeText: { light: '#E60012', dark: '#FF6B8A' },
};

/* ===================== Cookie / 手机号捕获 ===================== */

function getRequestHeader(headers, name) {
  if (!headers) return '';
  try {
    if (typeof headers.get === 'function') {
      return headers.get(name) || '';
    }
  } catch (e) {}
  try {
    for (const key of Object.keys(headers)) {
      if (String(key).toLowerCase() === name.toLowerCase()) {
        return headers[key] || '';
      }
    }
  } catch (e) {}
  return '';
}

function extractPhone(url) {
  if (!url) return '';
  try {
    const match = url.match(/[?&]desmobiel=([^&]+)/i);
    if (match && match[1]) return decodeURIComponent(match[1]).trim();
  } catch (e) {}
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
    const old = ctx.storage.get('unicom_cookie') || '';
    if (cookie !== old) {
      ctx.storage.set('unicom_cookie', cookie);
      changed = true;
    }
  }
  if (phone) {
    const old = ctx.storage.get('unicom_phone') || '';
    if (phone !== old) {
      ctx.storage.set('unicom_phone', phone);
      changed = true;
    }
  }
  if (changed && cookie && phone) {
    try {
      ctx.notify({
        title: '中国联通',
        body: '已自动获取登录信息，小组件将自动更新',
      });
    } catch (e) {}
  }
}

/* ===================== 请求 ===================== */

async function fetchUnicomData(ctx, cookie, phone) {
  const url =
    `${API_URL}?version=iphone_c@10.0100` +
    `&desmobiel=${encodeURIComponent(phone)}` +
    `&showType=0`;

  const resp = await ctx.http
    .get(url, {
      timeout: 10000,
      headers: {
        Host: API_HOST,
        'User-Agent': 'ChinaUnicom.x CFNetwork iOS/16.3',
        Cookie: cookie,
      },
      credentials: 'omit',
    })
    .catch((e) => {
      e.transient = true;
      throw e;
    });

  if (!resp) {
    const e = new Error('no-response');
    e.transient = true;
    throw e;
  }
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error(`HTTP ${resp.status}`);
    e.authFailed = true;
    throw e;
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
  if (!resp || resp.status !== 200) {
    throw new Error(`HTTP ${resp ? resp.status : 'no-response'}`);
  }
  const data = await resp.json();
  if (!data || String(data.code) !== '0000') {
    throw new Error(`API 返回异常：${data?.code || 'unknown'}`);
  }
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
  const addupItemCode = String(item.addupItemCode || '');
  const addUpItemName = String(item.addUpItemName || '');
  const feePolicyName = String(item.feePolicyName || '');
  return (
    addupItemCode === '40008' ||
    addUpItemName === '套餐内专享免费流量' ||
    resourceName === '免流流量' ||
    /（免流）|畅视/.test(feePolicyName)
  );
}

function formatFlowValue(value, unit) {
  const v = parseFloat(value) || 0;
  const u = String(unit || '').toUpperCase();
  if ((u === 'MB' || u === 'M') && v >= 1024) {
    return { value: Math.round((v / 1024) * 100) / 100, unit: 'GB' };
  }
  return { value: Math.round(v * 100) / 100, unit: String(unit || 'MB') };
}

function parseFlowDetail(data) {
  let generalRemain = 0;
  let directionalRemain = 0;
  let generalTotal = 0;
  let directionalTotal = 0;
  let generalUsed = 0;
  let directionalUsed = 0;

  for (const key of Object.keys(FLOW_RESOURCE_NAMES)) {
    const resourceName = FLOW_RESOURCE_NAMES[key];
    const list = data[key];
    if (!Array.isArray(list)) continue;
    for (const res of list) {
      const details = res.details;
      if (!Array.isArray(details)) continue;
      for (const item of details) {
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
  return {
    generalRemain,
    directionalRemain,
    generalTotal,
    directionalTotal,
    generalUsed,
    directionalUsed,
  };
}

function parseUnicomData(res) {
  if (
    !res ||
    res.code !== 'Y' ||
    !res.feeResource ||
    !res.voiceResource ||
    !res.flowResource
  ) {
    throw new Error(`API 返回异常：${res?.code || 'unknown'}`);
  }
  const feeResource = res.feeResource;
  const voiceResource = res.voiceResource;
  const flowResource = res.flowResource;
  const flowFormatted = formatFlowValue(
    flowResource.flowPersent ?? 0,
    flowResource.newUnit || 'MB'
  );

  return {
    fee: {
      title: feeResource.dynamicFeeTitle || '剩余话费',
      value: feeResource.feePersent ?? 0,
      unit: feeResource.newUnit || '元',
    },
    voice: {
      title: voiceResource.dynamicVoiceTitle || '剩余语音',
      value: voiceResource.voicePersent ?? 0,
      unit: voiceResource.newUnit || '分钟',
    },
    flow: {
      title: flowResource.dynamicFlowTitle || '剩余流量',
      value: flowFormatted.value,
      unit: flowFormatted.unit,
      usedFormatted: { value: 0, unit: 'MB' },
      totalFormatted: { value: flowFormatted.value, unit: flowFormatted.unit },
      remainMB: 0,
      usedMB: 0,
      totalMB: 0,
      percentUsed: 0,
      percentRemain: 100,
    },
    updateTime: new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai',
    }),
    timestamp: Date.now(),
  };
}

function notifyExpiredOnce(ctx, cookie) {
  const key = 'unicom_expired_notified';
  const marker = cookie || 'none';
  if (ctx.storage.get(key) === marker) return;
  ctx.storage.set(key, marker);
  try {
    ctx.notify({
      title: '中国联通',
      body: '登录已过期，请重新打开联通 App 获取登录信息',
    });
  } catch (e) {}
}

function clearExpiredFlag(ctx) {
  try {
    ctx.storage.remove('unicom_expired_notified');
  } catch (e) {}
}

async function loadData(ctx) {
  const cookie = ctx.storage.get('unicom_cookie') || '';
  const phone = ctx.storage.get('unicom_phone') || '';

  if (!cookie || !phone) {
    return { data: null, configured: false, error: null };
  }

  try {
    const res = await fetchUnicomData(ctx, cookie, phone);
    const data = parseUnicomData(res);

    const showGeneral = ctx.env?.CU_SHOW_GENERAL_FLOW !== 'false';
    const showDirectional = ctx.env?.CU_SHOW_DIRECTIONAL_FLOW !== 'false';

    try {
      const detail = await fetchFlowDetail(ctx, cookie);
      const p = parseFlowDetail(detail);

      let remainMB = 0;
      let totalMB = 0;
      let usedMB = 0;
      if (showGeneral) {
        remainMB += p.generalRemain;
        totalMB += p.generalTotal;
        usedMB += p.generalUsed;
      }
      if (showDirectional) {
        remainMB += p.directionalRemain;
        totalMB += p.directionalTotal;
        usedMB += p.directionalUsed;
      }
      if (totalMB <= 0 && (remainMB > 0 || usedMB > 0)) {
        totalMB = remainMB + usedMB;
      }

      const fr = formatFlowValue(remainMB, 'MB');
      const fu = formatFlowValue(usedMB, 'MB');
      const ft = formatFlowValue(totalMB, 'MB');
      data.flow.value = fr.value;
      data.flow.unit = fr.unit;
      data.flow.usedFormatted = fu;
      data.flow.totalFormatted = ft;
      data.flow.remainMB = remainMB;
      data.flow.usedMB = usedMB;
      data.flow.totalMB = totalMB;
      if (totalMB > 0) {
        data.flow.percentUsed = Math.min(100, Math.round((usedMB / totalMB) * 100));
        data.flow.percentRemain = Math.max(0, 100 - data.flow.percentUsed);
      }
    } catch (e) {
      // 明细失败不影响主数据
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

/* ===================== SVG 半圆进度 ===================== */

function makeSemiGaugeSVG(percentUsed) {
  const p = Math.max(0, Math.min(100, Number(percentUsed) || 0));
  const r = 42;
  const circ = Math.PI * r;
  const offset = circ * (1 - p / 100);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'>` +
    `<path d='M 8 50 A ${r} ${r} 0 0 1 92 50' fill='none' stroke='#FFD6E0' stroke-width='8' stroke-linecap='round'/>` +
    `<path d='M 8 50 A ${r} ${r} 0 0 1 92 50' fill='none' stroke='#FF6B8A' stroke-width='8' stroke-linecap='round' stroke-dasharray='${circ.toFixed(1)}' stroke-dashoffset='${offset.toFixed(1)}'/>` +
    `<circle cx='8' cy='50' r='4' fill='#FF6B8A'/>` +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/* ===================== UI 组件 ===================== */

function headerRow(updateTime, fromCache) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:simcard.fill',
            color: COLORS.accent,
            width: 16,
            height: 16,
          },
          {
            type: 'text',
            text: '中国联通',
            font: { size: 'headline', weight: 'semibold' },
            textColor: COLORS.value,
            maxLines: 1,
          },
          {
            type: 'stack',
            padding: [2, 6, 2, 6],
            borderRadius: 6,
            backgroundColor: COLORS.badgeBg,
            children: [
              {
                type: 'text',
                text: '5G',
                font: { size: 'caption2', weight: 'bold' },
                textColor: COLORS.badgeText,
              },
            ],
          },
        ],
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: fromCache
          ? `缓存 ${updateTime || '--:--'}`
          : `更新 ${updateTime || '--:--'}`,
        font: { size: 'caption2' },
        textColor: COLORS.time,
        maxLines: 1,
      },
    ],
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatGBFromMB(mb) {
  return round2((Number(mb) || 0) / 1024);
}

function getUsagePercent(used, total) {
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.min(100, Math.round(((Number(used) || 0) / t) * 100));
}

function dashboardText(text, size, color, weight) {
  return {
    type: 'text',
    text: String(text),
    font: {
      size,
      weight: weight || 'regular',
    },
    textColor: color,
    maxLines: 1,
    minScale: 0.55,
  };
}

function dashboardIcon(symbol, color, width, height) {
  return {
    type: 'image',
    src: `sf-symbol:${symbol}`,
    color,
    width: width || 17,
    height: height || 17,
  };
}

function dashboardPanel(children, options) {
  options = options || {};
  // Egern stack 仅支持 alignItems: start | end | center
  // 不支持 justifyContent / stretch，使用会导致大号不渲染
  return {
    type: 'stack',
    direction: options.direction || 'column',
    alignItems: options.alignItems || 'center',
    flex: options.flex === undefined ? 1 : options.flex,
    padding: options.padding || [9, 10, 9, 10],
    gap: options.gap === undefined ? 4 : options.gap,
    backgroundColor: {
      light: options.light || '#FFFFFFB8',
      dark: options.dark || '#FFFFFF0D',
    },
    borderRadius: options.radius || 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    children,
  };
}

function sideCard(iconColor, symbol, label, value, unit) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 8,
    padding: [8, 10, 8, 10],
    backgroundColor: COLORS.capsuleBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    children: [
      {
        type: 'stack',
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: {
          light: iconColor + '22',
          dark: iconColor + '33',
        },
        alignItems: 'center',
        children: [
          {
            type: 'image',
            src: symbol,
            color: iconColor,
            width: 14,
            height: 14,
          },
        ],
      },
      {
        type: 'stack',
        direction: 'column',
        gap: 1,
        children: [
          {
            type: 'text',
            text: label,
            font: { size: 'caption2', weight: 'medium' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 2,
            children: [
              {
                type: 'text',
                text: String(value),
                font: { size: 'title3', weight: 'bold' },
                textColor: COLORS.value,
                maxLines: 1,
                minScale: 0.6,
              },
              {
                type: 'text',
                text: unit,
                font: { size: 'caption2' },
                textColor: COLORS.subtitle,
                maxLines: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

/* 中号布局 */
function buildMediumWidget(data, fromCache) {
  const flow = data.flow || {};
  const percentUsed = flow.percentUsed ?? 0;
  const percentRemain = flow.percentRemain ?? 100;
  const usedText = flow.usedFormatted
    ? `${flow.usedFormatted.value} ${flow.usedFormatted.unit}`
    : '—';
  const totalText = flow.totalFormatted
    ? `${flow.totalFormatted.value} ${flow.totalFormatted.unit}`
    : '—';

  const leftCard = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 6,
    padding: [10, 8, 8, 8],
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:clock.fill',
            color: COLORS.softPink,
            width: 11,
            height: 11,
          },
          {
            type: 'text',
            text: '流量主卡',
            font: { size: 'caption2', weight: 'medium' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'image',
        src: makeSemiGaugeSVG(percentUsed),
        width: 76,
        height: 46,
      },
      {
        type: 'text',
        text: `${percentUsed}% 已用`,
        font: { size: 'caption2', weight: 'semibold' },
        textColor: COLORS.softPink,
        maxLines: 1,
      },
    ],
  };

  const centerBlock = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    children: [
      {
        type: 'stack',
        padding: [3, 10, 3, 10],
        borderRadius: 10,
        backgroundColor: COLORS.badgeBg,
        children: [
          {
            type: 'text',
            text: `${percentRemain}% 剩余`,
            font: { size: 'caption2', weight: 'semibold' },
            textColor: COLORS.accent,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          {
            type: 'text',
            text: String(flow.value ?? '—'),
            font: { size: 'title', weight: 'bold' },
            textColor: COLORS.value,
            maxLines: 1,
            minScale: 0.5,
          },
          {
            type: 'text',
            text: flow.unit || 'GB',
            font: { size: 'title3', weight: 'semibold' },
            textColor: COLORS.value,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'text',
        text: `已用 ${usedText}`,
        font: { size: 'caption1' },
        textColor: COLORS.subtitle,
        maxLines: 1,
      },
      {
        type: 'text',
        text: `套餐 ${totalText}`,
        font: { size: 'caption2' },
        textColor: COLORS.subtitle,
        maxLines: 1,
      },
    ],
  };

  const rightColumn = {
    type: 'stack',
    direction: 'column',
    gap: 8,
    children: [
      sideCard(
        '#FF9500',
        'sf-symbol:yensign.circle.fill',
        '话费',
        data.fee?.value ?? '—',
        data.fee?.unit === '元' ? '元' : data.fee?.unit || '元'
      ),
      sideCard(
        '#34C759',
        'sf-symbol:phone.fill',
        '语音',
        data.voice?.value ?? '—',
        data.voice?.unit === '分钟' ? '分' : data.voice?.unit || '分'
      ),
    ],
  };

  return {
    type: 'widget',
    padding: [12, 14, 12, 14],
    gap: 10,
    backgroundColor: COLORS.bg,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      headerRow(data.updateTime, fromCache),
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 10,
        children: [leftCard, centerBlock, rightColumn],
      },
    ],
  };
}

/* 大号 / 超大号：仪表盘三栏布局（仅用官方支持的 DSL 属性） */
function buildLargeWidget(data, fromCache) {
  const fee = data.fee || {};
  const voice = data.voice || {};
  const flow = data.flow || {};

  const remaining = Number(flow.value) || 0;
  const flowUnit = flow.unit || 'MB';

  const totalMB = Number(flow.totalMB) || 0;
  const usedMB = Number(flow.usedMB) || 0;
  const remainMB = Number(flow.remainMB) || 0;

  const hasDetail = totalMB > 0;
  const usedPercent = hasDetail ? getUsagePercent(usedMB, totalMB) : 0;
  const remainingPercent = hasDetail ? 100 - usedPercent : 100;

  const displayRemaining = `${remaining.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
  })} ${flowUnit}`;

  const displayUsed = hasDetail
    ? `${formatGBFromMB(usedMB)} GB`
    : '明细暂不可用';

  const displayTotal = hasDetail
    ? `${formatGBFromMB(totalMB)} GB`
    : '总量暂不可用';

  const percentLabel = hasDetail ? `${usedPercent}% 已用` : '流量余量';
  const remainLabel = hasDetail
    ? `${remainingPercent}% 剩余`
    : '当前剩余流量';

  const feeValue = `${fee.value ?? '--'}${fee.unit || '元'}`;
  const voiceValue = `${voice.value ?? '--'}${
    voice.unit === '分钟' ? '分钟' : voice.unit || '分钟'
  }`;

  // 左侧：流量主卡 + 半圆进度
  const gaugePanel = dashboardPanel(
    [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 5,
        children: [
          dashboardIcon('chart.pie.fill', COLORS.pink.light, 16, 16),
          dashboardText('流量主卡', 'headline', COLORS.value, 'semibold'),
        ],
      },
      {
        type: 'image',
        src: makeSemiGaugeSVG(usedPercent),
        width: 100,
        height: 60,
      },
      dashboardText(percentLabel, 'title3', COLORS.pink.light, 'bold'),
      dashboardText('流量使用率', 'caption2', COLORS.title),
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          dashboardIcon('chart.xyaxis.line', COLORS.pink.light, 13, 13),
          dashboardText('流量趋势', 'caption2', COLORS.title),
        ],
      },
    ],
    {
      flex: 1,
      padding: [12, 12, 12, 12],
      gap: 8,
      radius: 22,
      light: '#FFFFFFC9',
      dark: '#FFFFFF0B',
      alignItems: 'center',
    }
  );

  // 中间：剩余流量
  const flowPanel = {
    type: 'stack',
    direction: 'column',
    alignItems: 'start',
    flex: 1.4,
    padding: [8, 6, 8, 6],
    gap: 6,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          dashboardIcon('checkmark.circle.fill', COLORS.green.light, 13, 13),
          dashboardText(
            remainLabel,
            'subheadline',
            COLORS.green.light,
            'semibold'
          ),
        ],
      },
      {
        type: 'text',
        text: displayRemaining,
        font: { size: 'largeTitle', weight: 'bold' },
        textColor: COLORS.value,
        maxLines: 1,
        minScale: 0.4,
      },
      dashboardText(`已用 ${displayUsed}`, 'subheadline', COLORS.title),
      dashboardText(`套餐 ${displayTotal}`, 'subheadline', COLORS.title),
      { type: 'spacer' },
      dashboardText(
        hasDetail
          ? `剩余 ${round2(remainMB / 1024)} GB`
          : '数据来自中国联通',
        'caption2',
        COLORS.time
      ),
    ],
  };

  // 右侧：话费
  const feePanel = dashboardPanel(
    [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 7,
        children: [
          {
            type: 'stack',
            alignItems: 'center',
            width: 34,
            height: 34,
            backgroundColor: {
              light: '#FFF0D9',
              dark: '#F5A33A22',
            },
            borderRadius: 17,
            children: [dashboardIcon('yensign.circle.fill', COLORS.orange, 16, 16)],
          },
          dashboardText('话费', 'subheadline', COLORS.title),
        ],
      },
      dashboardText(feeValue, 'title2', COLORS.value, 'bold'),
    ],
    {
      padding: [10, 12, 10, 12],
      gap: 6,
      radius: 18,
      light: '#FFFFFFC9',
      dark: '#FFFFFF0B',
      alignItems: 'start',
      flex: 1,
    }
  );

  // 右侧：语音
  const voicePanel = dashboardPanel(
    [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 7,
        children: [
          {
            type: 'stack',
            alignItems: 'center',
            width: 34,
            height: 34,
            backgroundColor: {
              light: '#DFF8EC',
              dark: '#20B87922',
            },
            borderRadius: 17,
            children: [dashboardIcon('phone.fill', COLORS.green, 16, 16)],
          },
          dashboardText('语音', 'subheadline', COLORS.title),
        ],
      },
      dashboardText(voiceValue, 'title2', COLORS.value, 'bold'),
    ],
    {
      padding: [10, 12, 10, 12],
      gap: 6,
      radius: 18,
      light: '#FFFFFFC9',
      dark: '#FFFFFF0B',
      alignItems: 'start',
      flex: 1,
    }
  );

  const rightPanel = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    children: [
      feePanel,
      voicePanel,
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        padding: [6, 10, 6, 10],
        backgroundColor: {
          light: '#E7F8F0',
          dark: '#20B87920',
        },
        borderRadius: 15,
        children: [
          dashboardText(
            hasDetail ? `${usedPercent}% 已用` : '流量详情',
            'subheadline',
            COLORS.green,
            'semibold'
          ),
        ],
      },
    ],
  };

  return {
    type: 'widget',
    padding: [10, 12, 10, 12],
    gap: 8,
    backgroundColor: {
      light: '#F5F5FA',
      dark: '#202024',
    },
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      headerRow(data.updateTime, fromCache),
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 9,
        flex: 1,
        children: [gaugePanel, flowPanel, rightPanel],
      },
    ],
  };
}

function buildSmall(data) {
  const flow = data.flow || {};
  const percentUsed = flow.percentUsed ?? 0;
  const percentRemain = flow.percentRemain ?? 100;

  return {
    type: 'widget',
    padding: [10, 10, 10, 10],
    gap: 8,
    backgroundColor: COLORS.bg,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 4,
            children: [
              {
                type: 'image',
                src: 'sf-symbol:simcard.fill',
                color: COLORS.accent,
                width: 13,
                height: 13,
              },
              {
                type: 'text',
                text: '中国联通',
                font: { size: 'caption1', weight: 'semibold' },
                textColor: COLORS.value,
                maxLines: 1,
              },
            ],
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: data.updateTime || '--:--',
            font: { size: 'caption2' },
            textColor: COLORS.subtitle,
          },
        ],
      },
      {
        type: 'stack',
        direction: 'column',
        alignItems: 'center',
        gap: 2,
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 3,
            children: [
              {
                type: 'text',
                text: String(flow.value ?? '—'),
                font: { size: 'title', weight: 'bold' },
                textColor: COLORS.value,
                maxLines: 1,
                minScale: 0.55,
              },
              {
                type: 'text',
                text: flow.unit || 'GB',
                font: { size: 'caption1', weight: 'semibold' },
                textColor: COLORS.subtitle,
              },
            ],
          },
          {
            type: 'text',
            text: `${percentRemain}% 剩余 · ${percentUsed}% 已用`,
            font: { size: 'caption2' },
            textColor: COLORS.softPink,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 6,
        children: [
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            flex: 1,
            padding: [6, 4, 6, 4],
            backgroundColor: COLORS.capsuleBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            children: [
              {
                type: 'text',
                text: '话费',
                font: { size: 'caption2' },
                textColor: COLORS.subtitle,
              },
              {
                type: 'text',
                text: `${data.fee?.value ?? '—'}`,
                font: { size: 'headline', weight: 'bold' },
                textColor: COLORS.fee,
                maxLines: 1,
                minScale: 0.6,
              },
            ],
          },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            flex: 1,
            padding: [6, 4, 6, 4],
            backgroundColor: COLORS.capsuleBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            children: [
              {
                type: 'text',
                text: '语音',
                font: { size: 'caption2' },
                textColor: COLORS.subtitle,
              },
              {
                type: 'text',
                text: `${data.voice?.value ?? '—'}`,
                font: { size: 'headline', weight: 'bold' },
                textColor: COLORS.voice,
                maxLines: 1,
                minScale: 0.6,
              },
            ],
          },
        ],
      },
    ],
  };
}

function buildLockScreen(data, family) {
  const SUB = { light: '#FFFFFFB3', dark: '#FFFFFFB3' };
  const flow = data.flow || {};

  if (family === 'accessoryInline') {
    return {
      type: 'widget',
      children: [
        {
          type: 'text',
          text: `联通 ${data.fee?.value ?? '—'}${data.fee?.unit || '元'} · ${flow.value ?? '—'}${flow.unit || 'GB'}`,
          font: { size: 'caption1', weight: 'medium' },
          maxLines: 1,
          minScale: 0.5,
        },
      ],
    };
  }

  if (family === 'accessoryCircular') {
    return {
      type: 'widget',
      padding: 2,
      children: [
        { type: 'spacer' },
        {
          type: 'text',
          text: `${flow.value ?? '—'}`,
          font: { size: 'headline', weight: 'bold' },
          textAlign: 'center',
          maxLines: 1,
          minScale: 0.5,
        },
        {
          type: 'text',
          text: flow.unit || 'GB',
          font: { size: 'caption2' },
          textColor: SUB,
          textAlign: 'center',
          maxLines: 1,
        },
        { type: 'spacer' },
      ],
    };
  }

  const line = (label, value, unit) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 4,
    children: [
      {
        type: 'text',
        text: label,
        font: { size: 'caption2', weight: 'medium' },
        textColor: SUB,
        maxLines: 1,
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: String(value),
        font: { size: 'caption1', weight: 'bold' },
        maxLines: 1,
        minScale: 0.6,
      },
      {
        type: 'text',
        text: String(unit),
        font: { size: 'caption2' },
        textColor: SUB,
        maxLines: 1,
      },
    ],
  });

  return {
    type: 'widget',
    padding: 2,
    gap: 2,
    children: [
      line('话费', data.fee?.value ?? '—', data.fee?.unit || '元'),
      line('流量', flow.value ?? '—', flow.unit || 'GB'),
      line('语音', data.voice?.value ?? '—', data.voice?.unit || '分'),
    ],
  };
}

function buildError(title, message) {
  return {
    type: 'widget',
    padding: 12,
    backgroundColor: COLORS.bg,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:exclamationmark.triangle.fill',
            color: COLORS.error,
            width: 15,
            height: 15,
          },
          {
            type: 'text',
            text: title,
            font: { size: 'headline', weight: 'semibold' },
            textColor: COLORS.value,
            maxLines: 1,
          },
        ],
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: message,
        font: { size: 'caption1', weight: 'medium' },
        textColor: COLORS.subtitle,
        textAlign: 'center',
        maxLines: 3,
        minScale: 0.75,
      },
      { type: 'spacer' },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'spacer' },
          {
            type: 'stack',
            padding: [5, 12, 5, 12],
            backgroundColor: COLORS.capsuleBg,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
            children: [
              {
                type: 'text',
                text: '打开联通 App 查询一次',
                font: { size: 'caption2', weight: 'medium' },
                textColor: COLORS.accent,
                maxLines: 1,
              },
            ],
          },
          { type: 'spacer' },
        ],
      },
    ],
  };
}

async function handleWidget(ctx) {
  const title = '中国联通';
  const result = await loadData(ctx);
  const data = result.data;
  const fromCache = !!(result.error && data);

  if (!result.configured) {
    return buildError(title, '请打开联通 App，进入首页并点击余额位置');
  }
  if (!data) {
    return buildError(title, '数据获取失败，请重新打开联通 App 查询一次');
  }

  const family = ctx.widgetFamily || 'systemSmall';

  if (String(family).startsWith('accessory')) {
    return buildLockScreen(data, family);
  }
  if (family === 'systemSmall') {
    return buildSmall(data);
  }
  if (family === 'systemMedium') {
    return buildMediumWidget(data, fromCache);
  }
  if (family === 'systemLarge' || family === 'systemExtraLarge') {
    return buildLargeWidget(data, fromCache);
  }
  return buildSmall(data);
}

async function handleKeepAlive(ctx) {
  const cookie = ctx.storage.get('unicom_cookie') || '';
  const phone = ctx.storage.get('unicom_phone') || '';
  if (!cookie || !phone) return;
  try {
    await fetchUnicomData(ctx, cookie, phone);
  } catch (e) {}
}

export default async function (ctx) {
  if (ctx.request && ctx.request.url) {
    return handleCapture(ctx);
  }
  if (ctx.cron || (ctx.env && ctx.env.CU_KEEPALIVE === 'true')) {
    return handleKeepAlive(ctx);
  }
  return handleWidget(ctx);
}
