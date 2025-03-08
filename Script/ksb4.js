// 获取原始响应的 body
const body = $response.body ? JSON.parse($response.body) : {};

// 修改用户信息为 VIP
if (body.data) {
  // 修改 VIP 相关字段
  body.data.vip_type = "1"; // 设置为 VIP
  body.data.vip_level = "1"; // 设置 VIP 等级
  body.data.vip_expiration_time = "2099-12-31 23:59:59"; // 设置 VIP 过期时间为 2099 年

  // 修改 VIP 配置
  body.data.vip_config = {
    exam_questions_limit: "9999", // 考试题目限制
    paper_create_limit: "9999", // 试卷创建限制
    exam_paper_limit: "9999", // 考试试卷限制
    question_limit: "9999", // 题目限制
    paper_collect_limit: "9999", // 试卷收藏限制
    exam_member_limit: "9999", // 考试成员限制
    desc: "高级VIP用户", // 描述
    exam_limit: "9999", // 考试限制
    price: "0", // 价格
    paper_document_limit: "9999", // 试卷文档限制
    exam_submit_limit: "9999", // 考试提交限制
    paid_kaoshi_limit: "9999", // 付费考试限制
    alert_title: "高级VIP用户", // 提示标题
    paper_limit: "9999" // 试卷限制
  };

  // 修改其他相关字段
  body.data.is_show_ad = "0"; // 隐藏广告
  body.data.smart_create_question = "9999"; // 智能创建题目次数
  body.data.traffic_package = "10737418240"; // 流量包（10 GB）
}

// 返回修改后的响应
$done({
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});
