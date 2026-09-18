export default async function(ctx) {
  // 请求基础汇率数据
  const apiUrl = "https://api.exchangerate-api.com/v4/latest/USD";
  
  let rates = {};
  let isError = false;

  try {
    const resp = await ctx.http.get(apiUrl, { timeout: 5000 });
    const data = await resp.json();
    const cny = data.rates.CNY;
    
    rates = {
      USD: cny.toFixed(2),
      EUR: (cny / data.rates.EUR).toFixed(2),
      SGD: (cny / data.rates.SGD).toFixed(2),
      MYR: (cny / data.rates.MYR).toFixed(2),
      HKD: (cny / data.rates.HKD).toFixed(2),
      TWD: (cny / data.rates.TWD).toFixed(2),
      THB: (cny / data.rates.THB).toFixed(2), // 1泰铢兑换人民币
      VND: ((cny / data.rates.VND) * 10000).toFixed(2) // 1万越南盾兑换人民币
    };
  } catch (e) {
    isError = true;
  }

  const family = ctx.widgetFamily || "systemSmall";

  // ====== 锁屏小组件逻辑 ======
  if (family === "accessoryInline") {
    return { type: "widget", children: [{ type: "text", text: isError ? "获取失败" : `🇺🇸${rates.USD} 🇪🇺${rates.EUR} 🇸🇬${rates.SGD}` }] };
  }
  if (family === "accessoryRectangular") {
    if (isError) return { type: "widget", children: [{ type: "text", text: "网络请求失败" }] };
    return {
      type: "widget", gap: 4,
      children: [
        { type: "text", text: `🇺🇸 USD: ${rates.USD}`, font: { size: "headline", weight: "bold" } },
        { type: "text", text: `🇪🇺 EUR: ${rates.EUR}`, font: { size: "headline", weight: "bold" } },
        { type: "text", text: `🇸🇬 SGD: ${rates.SGD}`, font: { size: "headline", weight: "bold" } }
      ]
    };
  }
  if (family === "accessoryCircular") {
    if (isError) return { type: "widget", children: [{ type: "text", text: "Error" }] };
    return {
      type: "widget",
      children: [
        {
          type: "stack", direction: "column", alignItems: "center", gap: 2,
          children: [
            { type: "image", src: "sf-symbol:dollarsign.circle", width: 18, height: 18 },
            { type: "text", text: rates.USD, font: { size: "caption1", weight: "bold" } }
          ]
        }
      ]
    };
  }

  // ====== 主屏幕小组件 ======
  const isSmall = family === "systemSmall";
  const isMedium = family === "systemMedium";
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";

  // 动态间距和内边距配置 (8列模式下针对小号做了收紧调整)
  const rowSpacing = isLarge ? 16 : (isSmall ? 2 : 6);
  const titleSpacing = isLarge ? 20 : (isSmall ? 6 : 10);
  const paddingVal = isLarge ? 24 : 14;
  const titleText = isSmall ? "汇率 (CNY)" : "汇率看板 (CNY)";

  const contentChildren = [];

  if (!isError) {
    const list = [
      { name: "🇺🇸 USD", rate: rates.USD },
      { name: "🇪🇺 EUR", rate: rates.EUR },
      { name: "🇸🇬 SGD", rate: rates.SGD },
      { name: "🇲🇾 MYR", rate: rates.MYR },
      { name: "🇭🇰 HKD", rate: rates.HKD },
      { name: "🇹🇼 TWD", rate: rates.TWD },
      { name: "🇹🇭 THB", rate: rates.THB },
      { name: "🇻🇳 VND(10K)", rate: rates.VND }
    ];

    if (isMedium) {
      // --- 中号尺寸：左右双列排版逻辑 (4 + 4) ---
      const leftColChildren = [];
      const rightColChildren = [];
      
      const leftList = list.slice(0, 4);
      const rightList = list.slice(4, 8);

      const buildColItem = (item) => ({
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "text", text: item.name, font: { size: "footnote", weight: "medium" }, textColor: "#FFFFFF", flex: 1 },
          { type: "text", text: item.rate, font: { size: "footnote", weight: "bold" }, textColor: "#34C759" }
        ]
      });

      leftList.forEach((item, index) => {
        leftColChildren.push(buildColItem(item));
        if (index < leftList.length - 1) leftColChildren.push({ type: "spacer", length: rowSpacing });
      });

      rightList.forEach((item, index) => {
        rightColChildren.push(buildColItem(item));
        if (index < rightList.length - 1) rightColChildren.push({ type: "spacer", length: rowSpacing });
      });

      // 将左右两列放入一个横向并排的 Stack 中，中间用一个 spacer 隔开
      contentChildren.push({
        type: "stack",
        direction: "row",
        alignItems: "start",
        children: [
          { type: "stack", direction: "column", children: leftColChildren, flex: 1 },
          { type: "spacer", length: 20 }, // 左右两列的列间距
          { type: "stack", direction: "column", children: rightColChildren, flex: 1 }
        ]
      });

    } else {
      // --- 小号和大号：保持单列排版逻辑 (共 8 行) ---
      list.forEach((item, index) => {
        contentChildren.push({
          type: "stack",
          direction: "row",
          alignItems: "center",
          children: [
            { type: "text", text: item.name, font: { size: isSmall ? "caption1" : "subheadline", weight: "medium" }, textColor: "#FFFFFF", flex: 1 },
            { type: "text", text: item.rate, font: { size: isSmall ? "caption1" : "subheadline", weight: "bold" }, textColor: "#34C759" }
          ]
        });
        if (index < list.length - 1) contentChildren.push({ type: "spacer", length: rowSpacing });
      });
    }
  } else {
    contentChildren.push({ type: "text", text: "网络请求失败", textColor: "#FF3B30", font: { size: "subheadline" } });
  }

  // 构建最终配置
  return {
    type: "widget",
    backgroundGradient: {
      type: "linear",
      colors: ["#1A1A2E", "#16213E"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    padding: paddingVal,
    gap: 0,
    children: [
      // 标题行
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          { type: "image", src: "sf-symbol:banknote.fill", color: "#FF9500", width: 14, height: 14 },
          { type: "text", text: titleText, font: { size: isSmall ? "footnote" : "headline", weight: "bold" }, textColor: "#FFFFFF" }
        ]
      },
      { type: "spacer", length: titleSpacing },
      
      // 汇率内容区 (单列或双列)
      ...contentChildren,
      
      { type: "spacer" }, 
      
      // 底部时间区
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 4,
        children: [
          { type: "text", text: "更新于", font: { size: "caption2" }, textColor: "#888888" },
          { type: "date", date: new Date().toISOString(), format: "time", font: { size: "caption2" }, textColor: "#888888" }
        ]
      }
    ]
  };
}
