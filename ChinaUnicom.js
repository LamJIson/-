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

      // 今日流量使用：按当日首次记录的余量与当前余量差估算
      const usage = updateTodayUsage(ctx, remainMB);
      data.flow.todayUsedMB = usage.todayUsedMB;
      data.flow.hourlyMB = usage.hours;
      const tu = formatFlowValue(data.flow.todayUsedMB, 'MB');
      data.flow.todayUsedFormatted = tu;
    } catch (e) {
      // 明细失败不影响主数据
    }

    // 若明细失败，仍尝试用主接口剩余量估算今日使用
    if (data.flow.todayUsedMB == null) {
      const approxRemain = Number(data.flow.remainMB) || 0;
      if (approxRemain > 0) {
        const usage2 = updateTodayUsage(ctx, approxRemain);
        data.flow.todayUsedMB = usage2.todayUsedMB;
        data.flow.hourlyMB = usage2.hours;
        data.flow.todayUsedFormatted = formatFlowValue(data.flow.todayUsedMB, 'MB');
      } else {
        data.flow.todayUsedMB = 0;
        data.flow.todayUsedFormatted = { value: 0, unit: 'MB' };
      }
    }

    ctx.storage.setJSON('unicom_datasource', data);
    clearExpiredFlag(ctx);
    return { data, configured: true, error: null };
  } catch (e) {
    if (e && e.authFailed) notifyExpiredOnce(ctx, cookie);
    const cached = ctx.storage.getJSON('unicom_datasource');
    if (cached && cached.flow) {
      try {
        const snap = ctx.storage.getJSON('unicom_flow_snapshot');
        if (snap && Array.isArray(snap.hours)) {
          cached.flow.hourlyMB = snap.hours;
          if (snap.todayUsedMB != null && cached.flow.todayUsedMB == null) {
            cached.flow.todayUsedMB = snap.todayUsedMB;
            cached.flow.todayUsedFormatted = formatFlowValue(snap.todayUsedMB, 'MB');
          }
        }
      } catch (err) {}
    }
    return { data: cached || null, configured: true, error: e };
  }
}

/** 系统本地时区当前小时 0–23（0 = 0:00–0:59） */
function getLocalHour(date) {
  const d = date || new Date();
  let hour = d.getHours();
  if (!Number.isFinite(hour)) hour = 0;
  if (hour === 24) hour = 0;
  return ((hour % 24) + 24) % 24;
}


/** 按「今日首次余量 - 当前余量」估算今日已用流量（MB） */
function updateTodayUsage(ctx, remainMB) {
  const remain = Math.max(0, Number(remainMB) || 0);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${day}`;
  // 本地小时 0–23：柱[0]=0点, 柱[21]=21点（从左数第 22 根）
  const hour = getLocalHour(now);

  let snap = null;
  try {
    snap = ctx.storage.getJSON('unicom_flow_snapshot');
  } catch (e) {}
  snap = snap || {};

  // v3：纠正小时桶后强制清一次错误历史，避免旧数据偏一格
  const HOUR_VER = 3;
  let baseline = remain;
  let hours = Array(24).fill(0);

  if (snap.date === today && snap.hourVer === HOUR_VER) {
    if (typeof snap.baselineMB === 'number') baseline = snap.baselineMB;
    if (Array.isArray(snap.hours) && snap.hours.length === 24) {
      hours = snap.hours.map((v) => Math.max(0, Number(v) || 0));
    }
    if (typeof snap.remainMB === 'number' && snap.remainMB > remain) {
      const delta = snap.remainMB - remain;
      hours[hour] = (Number(hours[hour]) || 0) + delta;
    }
  } else if (snap.date === today && typeof snap.baselineMB === 'number') {
    // 同一天但版本变了：保留 baseline / 今日总量，清空小时柱重新累计
    baseline = snap.baselineMB;
    hours = Array(24).fill(0);
    if (typeof snap.remainMB === 'number' && snap.remainMB > remain) {
      const delta = snap.remainMB - remain;
      hours[hour] = delta;
    }
  } else {
    baseline = remain;
    hours = Array(24).fill(0);
  }

  const todayUsedMB = Math.max(0, baseline - remain);

  try {
    ctx.storage.setJSON('unicom_flow_snapshot', {
      date: today,
      hourVer: HOUR_VER,
      baselineMB: baseline,
      remainMB: remain,
      todayUsedMB,
      hours,
      lastHour: hour,
    });
  } catch (e) {}

  return { todayUsedMB, hours, hour };
}

function formatTodayUsageText(flow) {
  if (flow && flow.todayUsedFormatted) {
    return `${flow.todayUsedFormatted.value} ${flow.todayUsedFormatted.unit}`;
  }
  if (flow && flow.todayUsedMB != null) {
    const t = formatFlowValue(flow.todayUsedMB, 'MB');
    return `${t.value} ${t.unit}`;
  }
  return '—';
}

/** 简易柱状图 SVG（装饰用，模拟广电底部样式） */
/** 中国联通「中国结」标识（简化 SVG） */
function unicomLogoSVG() {
  // 简化中国结：双环交错 + 中心结，联通红
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
    `<g fill='none' stroke='#E60012' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'>` +
    // 左环
    `<path d='M20 18 C10 18 8 28 8 32 C8 42 16 48 24 48 C30 48 34 44 34 38'/>` +
    // 右环
    `<path d='M44 18 C54 18 56 28 56 32 C56 42 48 48 40 48 C34 48 30 44 30 38'/>` +
    // 上弧连接
    `<path d='M20 18 C24 10 40 10 44 18'/>` +
    // 中心交叉结
    `<path d='M26 32 C30 26 34 26 38 32'/>` +
    `<path d='M26 32 C30 38 34 38 38 32'/>` +
    // 下方两脚
    `<path d='M24 48 L20 58'/>` +
    `<path d='M40 48 L44 58'/>` +
    `</g>` +
    // 实心点缀
    `<circle cx='32' cy='32' r='3.2' fill='#E60012'/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeBarChartSVG(hourlyMB, options) {
  options = options || {};
  const w = options.width || 120;
  const h = options.height || 32;
  // 柱 i = 本地 i:00–i:59 用量
  const hours = Array.isArray(hourlyMB) && hourlyMB.length === 24
    ? hourlyMB.map((v) => Math.max(0, Number(v) || 0))
    : Array(24).fill(0);

  // 按「当天总用量」占比定高度：该小时 / 今日合计
  let total = 0;
  for (let i = 0; i < 24; i++) total += hours[i];
  if (total <= 0) total = 1;

  const gap = 1.0;
  const bw = (w - gap * 23) / 24;
  let rects = '';
  const curHour = getLocalHour();

  for (let i = 0; i < 24; i++) {
    const share = hours[i] / total; // 占当日已记录总量的比例
    let bh;
    if (hours[i] > 0) {
      // 高度 = 该小时占当日总量的比例（开方让小用量也能看见）
      bh = Math.min(h - 1, Math.max(4, Math.round(Math.sqrt(share) * (h - 2))));
    } else if (i === curHour) {
      bh = 3.5;
    } else if (i < curHour) {
      bh = 2.5;
    } else {
      bh = 2;
    }
    const x = i * (bw + gap);
    const y = h - bh;
    let color;
    if (i === curHour) {
      color = '#FF9F0A';
    } else if (hours[i] > 0) {
      color = '#5BBEDE';
    } else if (i < curHour) {
      color = '#5BBEDE66';
    } else {
      color = '#5BBEDE33';
    }
    rects += `<rect x='${x.toFixed(2)}' y='${y}' width='${bw.toFixed(2)}' height='${bh}' rx='0.6' fill='${color}'/>`;
  }

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>` +
    rects +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function todayUsageLevel(flow) {
  const mb = Number(flow && flow.todayUsedMB) || 0;
  return Math.max(0.15, Math.min(1, mb / 1024));
}







/* ===================== SVG 半圆进度 ===================== */

function makeSemiGaugeSVG(percentUsed, centerLabel) {
  // 按已用百分比动态绘制上半圆弧；centerLabel 显示在环内（如「流量」）
  const p = Math.max(0, Math.min(100, Number(percentUsed) || 0));
  const t = p / 100;
  const cx = 50;
  const cy = 52;
  const r = 40;
  const track =
    `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  let progress = '';
  if (t > 0.001) {
    const endAngle = Math.PI * (1 - t);
    const ex = cx + r * Math.cos(endAngle);
    const ey = cy - r * Math.sin(endAngle);
    const large = t > 0.5 ? 1 : 0;
    progress =
      `M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }

  const label = centerLabel
    ? `<text x='${cx}' y='${cy - 6}' text-anchor='middle' font-size='11' font-weight='600' fill='#8B7CF6' font-family='-apple-system,system-ui,sans-serif'>${String(centerLabel).replace(/[<>&'"]/g, '')}</text>`
    : '';

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 62'>` +
    `<path d='${track}' fill='none' stroke='#E8E0FF' stroke-width='10' stroke-linecap='round'/>` +
    (progress
      ? `<path d='${progress}' fill='none' stroke='#8B7CF6' stroke-width='10' stroke-linecap='round'/>`
      : '') +
    label +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
  const fee = data.fee || {};
  const voice = data.voice || {};
  const percentUsed = flow.percentUsed ?? 0;
  const percentRemain = flow.percentRemain ?? 100;
  const usedText = flow.usedFormatted
    ? `${flow.usedFormatted.value} ${flow.usedFormatted.unit}`
    : '—';
  const totalText = flow.totalFormatted
    ? `${flow.totalFormatted.value} ${flow.totalFormatted.unit}`
    : '—';
  const todayText = formatTodayUsageText(flow);

  const topBar = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 5,
    children: [
      {
        type: 'image',
        src: unicomLogoSVG(),
        width: 16,
        height: 16,
      },
      {
        type: 'text',
        text: '中国联通',
        font: { size: 'subheadline', weight: 'bold' },
        textColor: COLORS.value,
        maxLines: 1,
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: fromCache
          ? `缓存 ${data.updateTime || '--:--'}`
          : `更新 ${data.updateTime || '--:--'}`,
        font: { size: 'caption2' },
        textColor: COLORS.time,
        maxLines: 1,
      },
    ],
  };

  // 左：半圆进度
  const leftCol = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 2,
    flex: 0.95,
    children: [
      {
        type: 'image',
        src: makeSemiGaugeSVG(percentUsed, '流量'),
        width: 78,
        height: 48,
      },
      {
        type: 'text',
        text: `${percentUsed}% 已用`,
        font: { size: 'caption1', weight: 'bold' },
        textColor: { light: '#8B7CF6', dark: '#A99BFF' },
        maxLines: 1,
      },
    ],
  };

  // 中：剩余大数字
  const centerCol = {
    type: 'stack',
    direction: 'column',
    alignItems: 'start',
    gap: 2,
    flex: 1.2,
    children: [
      {
        type: 'text',
        text: `${percentRemain}% 剩余`,
        font: { size: 'caption1', weight: 'semibold' },
        textColor: { light: '#8B7CF6', dark: '#A99BFF' },
        maxLines: 1,
      },
      {
        type: 'text',
        text: `${flow.value ?? '—'} ${flow.unit || 'GB'}`,
        font: { size: 'title', weight: 'bold' },
        textColor: COLORS.value,
        maxLines: 1,
        minScale: 0.4,
      },
      {
        type: 'text',
        text: '当前剩余',
        font: { size: 'caption2' },
        textColor: COLORS.subtitle,
        maxLines: 1,
      },
      {
        type: 'text',
        text: `总量 ${totalText} · 已用 ${usedText}`,
        font: { size: 'caption1', weight: 'medium' },
        textColor: COLORS.value,
        maxLines: 1,
        minScale: 0.5,
      },
    ],
  };

  // 右：话费语音
  const rightCol = {
    type: 'stack',
    direction: 'column',
    alignItems: 'start',
    gap: 8,
    flex: 0.95,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:yensign.circle.fill',
            color: COLORS.orange.light,
            width: 12,
            height: 12,
          },
          {
            type: 'text',
            text: '话费',
            font: { size: 'caption2' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
          {
            type: 'text',
            text: `¥${fee.value ?? '--'}`,
            font: { size: 'caption1', weight: 'bold' },
            textColor: COLORS.value,
            maxLines: 1,
            minScale: 0.55,
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
            type: 'image',
            src: 'sf-symbol:phone.fill',
            color: { light: '#8B7CF6', dark: '#A99BFF' },
            width: 11,
            height: 11,
          },
          {
            type: 'text',
            text: '语音',
            font: { size: 'caption2' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
          {
            type: 'text',
            text: `${voice.value ?? '--'} 分`,
            font: { size: 'caption1', weight: 'bold' },
            textColor: COLORS.value,
            maxLines: 1,
            minScale: 0.55,
          },
        ],
      },
    ],
  };

  const mainRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    children: [leftCol, centerCol, rightCol],
  };

  const bottomRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 10,
    children: [
      {
        type: 'image',
        src: makeBarChartSVG(flow.hourlyMB, { width: 140, height: 28 }),
        width: 140,
        height: 28,
      },
      { type: 'spacer' },
      {
        type: 'stack',
        direction: 'column',
        alignItems: 'end',
        gap: 1,
        children: [
          {
            type: 'text',
            text: '今日流量使用',
            font: { size: 'caption2' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
          {
            type: 'text',
            text: todayText,
            font: { size: 'subheadline', weight: 'bold' },
            textColor: { light: '#2E9BC0', dark: '#5BBEDE' },
            maxLines: 1,
            minScale: 0.55,
          },
        ],
      },
    ],
  };;

  return {
    type: 'widget',
    padding: [10, 12, 10, 12],
    gap: 8,
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    refreshAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    children: [topBar, mainRow, bottomRow],
  };
}

/* 大号 / 超大号：仪表盘三栏布局（仅用官方支持的 DSL 属性） */
function buildLargeWidget(data, fromCache) {
  const flow = data.flow || {};
  const fee = data.fee || {};
  const voice = data.voice || {};
  const percentUsed = flow.percentUsed ?? 0;
  const percentRemain = flow.percentRemain ?? 100;
  const usedText = flow.usedFormatted
    ? `${flow.usedFormatted.value} ${flow.usedFormatted.unit}`
    : '—';
  const totalText = flow.totalFormatted
    ? `${flow.totalFormatted.value} ${flow.totalFormatted.unit}`
    : '—';
  const todayText = formatTodayUsageText(flow);

  const topBar = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 5,
    children: [
      {
        type: 'image',
        src: unicomLogoSVG(),
        width: 18,
        height: 18,
      },
      {
        type: 'text',
        text: '中国联通',
        font: { size: 'headline', weight: 'bold' },
        textColor: COLORS.value,
        maxLines: 1,
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: fromCache
          ? `缓存 ${data.updateTime || '--:--'}`
          : `更新 ${data.updateTime || '--:--'}`,
        font: { size: 'caption2' },
        textColor: COLORS.time,
        maxLines: 1,
      },
    ],
  };

  const flowLeft = {
    type: 'stack',
    direction: 'column',
    alignItems: 'start',
    gap: 3,
    flex: 1.4,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 5,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:chart.pie.fill',
            color: { light: '#8B7CF6', dark: '#A99BFF' },
            width: 14,
            height: 14,
          },
          {
            type: 'text',
            text: '剩余流量',
            font: { size: 'subheadline', weight: 'semibold' },
            textColor: COLORS.value,
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
            font: { size: 'largeTitle', weight: 'bold' },
            textColor: COLORS.value,
            maxLines: 1,
            minScale: 0.4,
          },
          {
            type: 'text',
            text: flow.unit || 'GB',
            font: { size: 'title3', weight: 'semibold' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'text',
        text: `总量 ${totalText} · 已用 ${usedText}`,
        font: { size: 'caption1' },
        textColor: COLORS.subtitle,
        maxLines: 1,
        minScale: 0.6,
      },
    ],
  };

  const flowRight = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 2,
    children: [
      {
        type: 'text',
        text: `${percentRemain}% 剩余`,
        font: { size: 'caption1', weight: 'semibold' },
        textColor: { light: '#8B7CF6', dark: '#A99BFF' },
        maxLines: 1,
      },
      {
        type: 'image',
        src: makeSemiGaugeSVG(percentUsed),
        width: 88,
        height: 50,
      },
      {
        type: 'text',
        text: `${percentUsed}% 已用`,
        font: { size: 'caption1', weight: 'bold' },
        textColor: { light: '#8B7CF6', dark: '#A99BFF' },
        maxLines: 1,
      },
    ],
  };

  const flowRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 12,
    children: [flowLeft, flowRight],
  };

  const feeCard = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 5,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:yensign.circle.fill',
            color: COLORS.orange.light,
            width: 14,
            height: 14,
          },
          {
            type: 'text',
            text: '剩余话费',
            font: { size: 'caption1' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 2,
        children: [
          {
            type: 'text',
            text: `¥${fee.value ?? '--'}`,
            font: { size: 'title', weight: 'bold' },
            textColor: COLORS.value,
            maxLines: 1,
            minScale: 0.55,
          },
          {
            type: 'text',
            text: '元',
            font: { size: 'caption1' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
        ],
      },
    ],
  };

  const voiceCard = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 5,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:phone.fill',
            color: { light: '#8B7CF6', dark: '#A99BFF' },
            width: 13,
            height: 13,
          },
          {
            type: 'text',
            text: '剩余语音',
            font: { size: 'caption1' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 2,
        children: [
          {
            type: 'text',
            text: String(voice.value ?? '--'),
            font: { size: 'title', weight: 'bold' },
            textColor: COLORS.value,
            maxLines: 1,
            minScale: 0.55,
          },
          {
            type: 'text',
            text: '分钟',
            font: { size: 'caption1' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
        ],
      },
    ],
  };

  const midCards = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 16,
    children: [feeCard, voiceCard],
  };

  const todayRow = {
    type: 'stack',
    direction: 'column',
    alignItems: 'start',
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
            src: 'sf-symbol:chart.bar.fill',
            color: { light: '#2E9BC0', dark: '#5BBEDE' },
            width: 13,
            height: 13,
          },
          {
            type: 'text',
            text: '今日流量使用',
            font: { size: 'caption1', weight: 'semibold' },
            textColor: COLORS.value,
            maxLines: 1,
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: todayText,
            font: { size: 'title2', weight: 'bold' },
            textColor: { light: '#2E9BC0', dark: '#5BBEDE' },
            maxLines: 1,
            minScale: 0.55,
          },
        ],
      },
      {
        type: 'image',
        src: makeBarChartSVG(flow.hourlyMB, { width: 220, height: 36 }),
        width: 220,
        height: 36,
      },
      {
        type: 'text',
        text: '按今日已记录余量变化估算',
        font: { size: 'caption2' },
        textColor: COLORS.subtitle,
        maxLines: 1,
      },
    ],
  };

  const footer = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 4,
    children: [
      {
        type: 'image',
        src: 'sf-symbol:clock',
        color: COLORS.time,
        width: 11,
        height: 11,
      },
      {
        type: 'text',
        text: `最近更新 · ${data.updateTime || '--:--'}`,
        font: { size: 'caption2' },
        textColor: COLORS.time,
        maxLines: 1,
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: '每 30 分钟刷新',
        font: { size: 'caption2' },
        textColor: COLORS.time,
        maxLines: 1,
      },
    ],
  };

  return {
    type: 'widget',
    padding: [14, 16, 12, 16],
    gap: 12,
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    refreshAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    children: [topBar, flowRow, midCards, todayRow, footer],
  };
}

function buildSmall(data) {
  const flow = data.flow || {};
  const fee = data.fee || {};
  const voice = data.voice || {};
  const percentUsed = flow.percentUsed ?? 0;
  const usedText = flow.usedFormatted
    ? `${flow.usedFormatted.value} ${flow.usedFormatted.unit}`
    : '—';
  const totalText = flow.totalFormatted
    ? `${flow.totalFormatted.value} ${flow.totalFormatted.unit}`
    : '—';
  const todayText = formatTodayUsageText(flow);

  const topBar = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 5,
    children: [
      {
        type: 'image',
        src: unicomLogoSVG(),
        width: 16,
        height: 16,
      },
      {
        type: 'text',
        text: '中国联通',
        font: { size: 'subheadline', weight: 'bold' },
        textColor: COLORS.value,
        maxLines: 1,
      },
      { type: 'spacer' },
      {
        type: 'text',
        text: data.updateTime || '--:--',
        font: { size: 'caption2' },
        textColor: COLORS.time,
        maxLines: 1,
      },
    ],
  };

  const leftFlow = {
    type: 'stack',
    direction: 'column',
    alignItems: 'start',
    gap: 2,
    flex: 1,
    children: [
      {
        type: 'text',
        text: '剩余流量',
        font: { size: 'caption1', weight: 'semibold' },
        textColor: COLORS.subtitle,
        maxLines: 1,
      },
      {
        type: 'text',
        text: `${flow.value ?? '—'} ${flow.unit || 'GB'}`,
        font: { size: 'title2', weight: 'bold' },
        textColor: COLORS.value,
        maxLines: 1,
        minScale: 0.5,
      },
      {
        type: 'text',
        text: `已用 ${usedText}`,
        font: { size: 'caption2', weight: 'semibold' },
        textColor: { light: '#8B7CF6', dark: '#A99BFF' },
        maxLines: 1,
      },
      {
        type: 'text',
        text: `总量 ${totalText}`,
        font: { size: 'caption2' },
        textColor: COLORS.subtitle,
        maxLines: 1,
      },
    ],
  };

  const rightGauge = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 1,
    children: [
      {
        type: 'image',
        src: makeSemiGaugeSVG(percentUsed),
        width: 70,
        height: 40,
      },
      {
        type: 'text',
        text: `${percentUsed}% 已用`,
        font: { size: 'caption1', weight: 'bold' },
        textColor: { light: '#8B7CF6', dark: '#A99BFF' },
        maxLines: 1,
      },
      {
        type: 'text',
        text: '今日',
        font: { size: 'caption2' },
        textColor: COLORS.subtitle,
        maxLines: 1,
      },
      {
        type: 'text',
        text: todayText,
        font: { size: 'headline', weight: 'bold' },
        textColor: { light: '#2E9BC0', dark: '#5BBEDE' },
        maxLines: 1,
        minScale: 0.7,
      },
    ],
  };

  const midRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    children: [leftFlow, rightGauge],
  };

  const voiceBlock = {
    type: 'stack',
    direction: 'column',
    alignItems: 'start',
    gap: 2,
    flex: 1,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:phone.fill',
            color: { light: '#8B7CF6', dark: '#A99BFF' },
            width: 12,
            height: 12,
          },
          {
            type: 'text',
            text: '剩余语音',
            font: { size: 'caption2' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'text',
        text: `${voice.value ?? '--'} 分钟`,
        font: { size: 'headline', weight: 'bold' },
        textColor: COLORS.value,
        maxLines: 1,
        minScale: 0.6,
      },
    ],
  };

  const feeBlock = {
    type: 'stack',
    direction: 'column',
    alignItems: 'start',
    gap: 2,
    flex: 1,
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 4,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:yensign.circle.fill',
            color: COLORS.orange.light,
            width: 12,
            height: 12,
          },
          {
            type: 'text',
            text: '剩余话费',
            font: { size: 'caption2' },
            textColor: COLORS.subtitle,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'text',
        text: `¥ ${fee.value ?? '--'}`,
        font: { size: 'headline', weight: 'bold' },
        textColor: COLORS.value,
        maxLines: 1,
        minScale: 0.6,
      },
    ],
  };

  const bottomRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 10,
    children: [voiceBlock, feeBlock],
  };

  return {
    type: 'widget',
    padding: [12, 12, 12, 12],
    gap: 10,
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    refreshAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    children: [topBar, midRow, bottomRow],
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
