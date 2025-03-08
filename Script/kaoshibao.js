// 获取原始响应的 body
const body = $response.body ? JSON.parse($response.body) : {};

// 定义一个函数，用于过滤掉 mini_hide 为 "1" 的图标
const filterIcons = (icons) => {
  return icons.filter(item => item.mini_hide !== "1");
};

// 遍历 data.icon 下的所有数组，过滤掉 mini_hide 为 "1" 的图标
if (body.data && body.data.icon) {
  const iconData = body.data.icon;

  // 过滤 level_2
  if (iconData.level_2 && Array.isArray(iconData.level_2)) {
    iconData.level_2 = filterIcons(iconData.level_2);
  }

  // 过滤 document_detail
  if (iconData.document_detail && Array.isArray(iconData.document_detail)) {
    iconData.document_detail = filterIcons(iconData.document_detail);
  }

  // 过滤 level_1
  if (iconData.level_1 && Array.isArray(iconData.level_1)) {
    iconData.level_1 = filterIcons(iconData.level_1);
  }

  // 过滤 mini_document_detail
  if (iconData.mini_document_detail && Array.isArray(iconData.mini_document_detail)) {
    iconData.mini_document_detail = filterIcons(iconData.mini_document_detail);
  }
}

// 返回修改后的响应
$done({
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});