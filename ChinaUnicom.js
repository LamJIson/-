/**
 * 中国联通话费流量小组件（玻璃拟态风格 · 对齐官方卡片视觉）
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
 * （汇总：话费/语音/流量总数）
 *
 * 流量明细接口（通用/定向分项）：
 * POST https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune
 *
 * 三种用法（同一个 JS）：
 * http_request → 自动抓 Cookie / 手机号
 * generic      → 显示 Widget
 * schedule     → 保活：定时查一次接口续 session（ctx.cron 或 Env CU_KEEPALIVE=true）
 *
 * 环境变量（可选）：
 * CU_SHOW_GENERAL_FLOW=true/false     是否计入通用流量（默认 true）
 * CU_SHOW_DIRECTIONAL_FLOW=true/false 是否计入定向/免流流量（默认 true）
 * CU_KEEPALIVE=true                   schedule 保活开关
 */

/* =========================================================
 * 基础配置
 * ========================================================= */

const API_HOST = 'm.client.10010.com';

const API_URL =
  'https://m.client.10010.com/mobileserviceimportant/home/queryUserInfoSeven';

const FLOW_DETAIL_URL =
  'https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune';

/* =========================================================
 * 颜色（对齐截图：粉色主调 + 玻璃拟态）
 * ========================================================= */

const COLORS = {
  // 主背景（半透明玻璃）
  bg: {
    light: '#FFFFFFE6',
    dark: '#1C1C1EE6',
  },

  // 卡片内背景
  card: {
    light: '#FFFFFFCC',
    dark: '#2C2C2ECC',
  },

  // 边框
  border: {
    light: '#FFFFFF80',
    dark: '#3A3A3C80',
  },

  // 主文字
  title: {
    light: '#1C1C1E',
    dark: '#F5F5F7',
  },

  // 次要文字
  subtitle: {
    light: '#8E8E93',
    dark: '#98989D',
  },

  // 联通粉 / 强调色
  accent: {
    light: '#E60012',
    dark: '#FF375F',
  },

  softPink: {
    light: '#FF6B8A',
    dark: '#FF6B8A',
  },

  // 话费橙
  fee: {
    light: '#FF9500',
    dark: '#FF9F0A',
  },

  // 语音绿
  voice: {
    light: '#34C759',
    dark: '#30D158',
  },

  // 错误
  error: {
    light: '#FF3B30',
    dark: '#FF453A',
  },

  // 胶囊浅底
  capsuleBg: {
    light: '#FFFFFF90',
    dark: '#FFFFFF12',
  },

  // 5G 徽章
  badgeBg: {
    light: '#FFE5EC',
    dark: '#3A1F2A',
  },

  badgeText: {
    light: '#E60012',
    dark: '#FF6B8A',
  },
};

/* =========================================================
 * Cookie / 手机号捕获
 * ========================================================= */

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
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
  } catch (e) {}

  return '';
}

async function handleCapture(ctx) {
  const req = ctx.request || {};
  const url = String(req.url || '');

  if (!url) return;
  if (!url.includes(API_HOST)) return;

  const cookie = String(
    getRequestHeader(req.headers, 'cookie') || ''
  ).trim();

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
    ctx.notify({
      title: '中国联通',
      body: '已自动获取登录信息，小组件将自动更新',
    });
  }
}

/* =========================================================
 * 数据请求
 * ========================================================= */

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

  if (resp.status !== 200) {
    throw new Error(`HTTP ${resp.status}`);
  }

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
    return {
      value: Math.round((v / 1024) * 100) / 100,
      unit: 'GB',
    };
  }

  return {
    value: Math.round(v * 100) / 100,
    unit: String(unit || 'MB'),
  };
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

/* =========================================================
 * 数据解析
 * ========================================================= */

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
      // 以下字段在明细成功后会被覆盖
      remainMB: parseFloat(flowResource.flowPersent) || 0,
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

/* =========================================================
 * 加载数据
 * ========================================================= */

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
    return {
      data: null,
      configured: false,
      error: null,
    };
  }

  try {
    const res = await fetchUnicomData(ctx, cookie, phone);
    const data = parseUnicomData(res);

    const showGeneralFlow = ctx.env.CU_SHOW_GENERAL_FLOW !== 'false';
    const showDirectionalFlow = ctx.env.CU_SHOW_DIRECTIONAL_FLOW !== 'false';

    try {
      const detail = await fetchFlowDetail(ctx, cookie);
      const {
        generalRemain,
        directionalRemain,
        generalTotal,
        directionalTotal,
        generalUsed,
        directionalUsed,
      } = parseFlowDetail(detail);

      let remainMB = 0;
      let totalMB = 0;
      let usedMB = 0;

      if (showGeneralFlow) {
        remainMB += generalRemain;
        totalMB += generalTotal;
        usedMB += generalUsed;
      }
      if (showDirectionalFlow) {
        remainMB += directionalRemain;
        totalMB += directionalTotal;
        usedMB += directionalUsed;
      }

      // 若 total 为 0，用 remain + used 兜底
      if (totalMB <= 0 && (remainMB > 0 || usedMB > 0)) {
        totalMB = remainMB + usedMB;
      }

      const formattedRemain = formatFlowValue(remainMB, 'MB');
      const formattedUsed = formatFlowValue(usedMB, 'MB');
      const formattedTotal = formatFlowValue(totalMB, 'MB');

      data.flow.value = formattedRemain.value;
      data.flow.unit = formattedRemain.unit;
      data.flow.remainMB = remainMB;
      data.flow.usedMB = usedMB;
      data.flow.totalMB = totalMB;
      data.flow.usedFormatted = formattedUsed;
      data.flow.totalFormatted = formattedTotal;

      if (totalMB > 0) {
        data.flow.percentUsed = Math.min(
          100,
          Math.round((usedMB / totalMB) * 100)
        );
        data.flow.percentRemain = Math.max(
          0,
          100 - data.flow.percentUsed
        );
      } else {
        data.flow.percentUsed = 0;
        data.flow.percentRemain = 100;
      }
    } catch (e) {
      // 明细失败时保持汇总接口的剩余值
      data.flow.usedFormatted = { value: 0, unit: 'MB' };
      data.flow.totalFormatted = {
        value: data.flow.value,
        unit: data.flow.unit,
      };
    }

    ctx.storage.setJSON('unicom_datasource', data);
    clearExpiredFlag(ctx);

    return {
      data,
      configured: true,
      error: null,
    };
  } catch (e) {
    if (e && e.authFailed) {
      notifyExpiredOnce(ctx, cookie);
    }

    const cached = ctx.storage.getJSON('unicom_datasource');

    return {
      data: cached || null,
      configured: true,
      error: e,
    };
  }
}

/* =========================================================
 * SVG 半圆进度条（用于左卡）
 * percentUsed: 0~100
 * ========================================================= */

function makeSemiGaugeSVG(percentUsed) {
  const p = Math.max(0, Math.min(100, percentUsed || 0));
  // 半圆弧：从左到右，约 180 度
  // 用 stroke-dasharray 实现进度
  const r = 42;
  const cx = 50;
  const cy = 50;
  const circumference = Math.PI * r; // 半圆周长
  const offset = circumference * (1 - p / 100);

  // 粉色主弧 + 浅底弧
  return (
    `data:image/svg+xml,` +
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'>` +
    `<path d='M 8 50 A ${r} ${r} 0 0 1 92 50' fill='none' stroke='#FFD6E0' stroke-width='8' stroke-linecap='round'/>` +
    `<path d='M 8 50 A ${r} ${r} 0 0 1 92 50' fill='none' stroke='#FF6B8A' stroke-width='8' stroke-linecap='round' ` +
    `stroke-dasharray='${circumference.toFixed(2)}' stroke-dashoffset='${offset.toFixed(2)}'/>` +
    `<circle cx='8' cy='50' r='4' fill='#FF6B8A'/>` +
    `</svg>`
  );
}

/* 简单趋势线装饰 */
function makeTrendSVG() {
  return (
    `data:image/svg+xml,` +
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 20'>` +
    `<polyline points='0,14 18,12 32,8 48,10 62,6 80,4' fill='none' stroke='#FF6B8A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>` +
    `<circle cx='80' cy='4' r='2.5' fill='#FF6B8A'/>` +
    `</svg>`
  );
}

/* =========================================================
 * 顶部标题栏（中号 / 大号）
 * ========================================================= */

function headerRow(updateTime) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 6,
    children: [
      // 左侧：Logo + 中国联通 + 5G
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,
        children: [
          {
            type: 'image',
            src: 'sf-symbol:network',
            color: COLORS.accent,
            width: 16,
            height: 16,
          },
          {
            type: 'text',
            text: '中国联通',
            font: { size: 'headline', weight: 'semibold' },
            textColor: COLORS.title,
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
      // 右侧更新时间
      {
        type: 'text',
        text: `更新 ${updateTime || '--:--'}`,
        font: { size: 'caption2' },
        textColor: COLORS.subtitle,
        maxLines: 1,
      },
    ],
  };
}

/* =========================================================
 * 右侧小卡片（话费 / 语音）
 * ========================================================= */

function sideCard(iconColor, iconSymbol, label, value, unit) {
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
        justifyContent: 'center',
        children: [
          {
            type: 'image',
            src: iconSymbol,
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
            alignItems: 'baseline',
            gap: 2,
            children: [
              {
                type: 'text',
                text: String(value),
                font: { size: 'title3', weight: 'bold' },
                textColor: COLORS.title,
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

/* =========================================================
 * 中号 / 大号 主布局（对齐截图）
 * ========================================================= */

function buildMainWidget(data, family) {
  const flow = data.flow || {};
  const percentUsed = flow.percentUsed ?? 0;
  const percentRemain = flow.percentRemain ?? 100;

  const usedText = flow.usedFormatted
    ? `${flow.usedFormatted.value} ${flow.usedFormatted.unit}`
    : '—';
  const totalText = flow.totalFormatted
    ? `${flow.totalFormatted.value} ${flow.totalFormatted.unit}`
    : '—';

  const isLarge =
    family === 'systemLarge' || family === 'systemExtraLarge';

  // 左侧：流量主卡 + 半圆进度
  const leftCard = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    gap: 6,
    padding: [10, 10, 8, 10],
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: isLarge ? 0 : 1,
    width: isLarge ? 120 : undefined,
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
        width: isLarge ? 90 : 80,
        height: isLarge ? 54 : 48,
      },
      {
        type: 'text',
        text: `${percentUsed}% 已用`,
        font: { size: 'caption2', weight: 'semibold' },
        textColor: COLORS.softPink,
        maxLines: 1,
      },
      {
        type: 'image',
        src: makeTrendSVG(),
        width: 56,
        height: 14,
      },
    ],
  };

  // 中间：大数字剩余 + 已用/套餐
  const centerBlock = {
    type: 'stack',
    direction: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
    children: [
      {
        type: 'stack',
        padding: [3, 10, 3, 10],
        borderRadius: 10,
        backgroundColor: {
          light: '#FFE5EC',
          dark: '#3A1F2A',
        },
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
        alignItems: 'baseline',
        gap: 4,
        children: [
          {
            type: 'text',
            text: String(flow.value ?? '—'),
            font: { size: isLarge ? 'largeTitle' : 'title', weight: 'bold' },
            textColor: COLORS.title,
            maxLines: 1,
            minScale: 0.5,
          },
          {
            type: 'text',
            text: flow.unit || 'GB',
            font: { size: 'title3', weight: 'semibold' },
            textColor: COLORS.title,
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

  // 右侧：话费 + 语音
  const rightColumn = {
    type: 'stack',
    direction: 'column',
    gap: 8,
    flex: isLarge ? 0 : 1,
    width: isLarge ? 140 : undefined,
    children: [
      sideCard(
        COLORS.fee.light,
        'sf-symbol:yensign.circle.fill',
        '话费',
        data.fee?.value ?? '—',
        data.fee?.unit === '元' ? '元' : data.fee?.unit || '元'
      ),
      sideCard(
        COLORS.voice.light,
        'sf-symbol:phone.fill',
        '语音',
        data.voice?.value ?? '—',
        data.voice?.unit === '分钟' ? '分' : data.voice?.unit || '分'
      ),
    ],
  };

  const mainRow = {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    children: [leftCard, centerBlock, rightColumn],
  };

  // 底部提示（大号多一行）
  const bottomHint = isLarge
    ? {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'spacer' },
          {
            type: 'stack',
            padding: [4, 10, 4, 10],
            borderRadius: 10,
            backgroundColor: {
              light: '#E8F8EE',
              dark: '#1A3A28',
            },
            children: [
              {
                type: 'text',
                text: `${percentUsed}% 已用`,
                font: { size: 'caption2', weight: 'medium' },
                textColor: COLORS.voice,
              },
            ],
          },
        ],
      }
    : null;

  const children = [headerRow(data.updateTime), mainRow];
  if (bottomHint) children.push(bottomHint);

  return {
    type: 'widget',
    padding: [12, 14, 12, 14],
    gap: 10,
    backgroundColor: COLORS.bg,
    refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    children,
  };
}

/* =========================================================
 * 小尺寸
 * ========================================================= */

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
      // 顶部：联通 + 更新时间
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
                src: 'sf-symbol:network',
                color: COLORS.accent,
                width: 13,
                height: 13,
              },
              {
                type: 'text',
                text: '中国联通',
                font: { size: 'caption1', weight: 'semibold' },
                textColor: COLORS.title,
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

      // 大数字剩余
      {
        type: 'stack',
        direction: 'column',
        alignItems: 'center',
        gap: 2,
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'baseline',
            gap: 3,
            children: [
              {
                type: 'text',
                text: String(flow.value ?? '—'),
                font: { size: 'title', weight: 'bold' },
                textColor: COLORS.title,
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

      // 底部两卡：话费 + 语音
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

/* =========================================================
 * 锁屏
 * ========================================================= */

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

  // accessoryRectangular
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

/* =========================================================
 * 错误界面
 * ========================================================= */

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
            textColor: COLORS.title,
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

/* =========================================================
 * Widget 主逻辑
 * ========================================================= */

async function handleWidget(ctx) {
  const title = '中国联通';
  const result = await loadData(ctx);
  const data = result.data;

  if (!result.configured) {
    return buildError(title, '请打开联通 App，进入首页并点击余额位置');
  }

  if (!data) {
    return buildError(title, '数据获取失败，请重新打开联通 App 查询一次');
  }

  const family = ctx.widgetFamily || 'systemSmall';

  if (family.startsWith('accessory')) {
    return buildLockScreen(data, family);
  }

  if (family === 'systemSmall') {
    return buildSmall(data);
  }

  if (
    family === 'systemMedium' ||
    family === 'systemLarge' ||
    family === 'systemExtraLarge'
  ) {
    return buildMainWidget(data, family);
  }

  return buildSmall(data);
}

/* =========================================================
 * 保活
 * ========================================================= */

async function handleKeepAlive(ctx) {
  const cookie = ctx.storage.get('unicom_cookie') || '';
  const phone = ctx.storage.get('unicom_phone') || '';
  if (!cookie || !phone) return;

  try {
    await fetchUnicomData(ctx, cookie, phone);
  } catch (e) {}
}

/* =========================================================
 * Egern 入口
 * ========================================================= */

export default async function (ctx) {
  if (ctx.request && ctx.request.url) {
    return handleCapture(ctx);
  }

  if (ctx.cron || (ctx.env && ctx.env.CU_KEEPALIVE === 'true')) {
    return handleKeepAlive(ctx);
  }

  return handleWidget(ctx);
}
