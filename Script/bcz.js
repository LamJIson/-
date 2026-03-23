// baicizhan_vip.js
// Surge脚本 - 百词斩阅读VIP解锁

console.log("百词斩VIP解锁脚本已加载");

function modifyUserInfo(body) {
    try {
        let data = JSON.parse(body);
        
        if (data && data.data) {
            console.log("原始用户数据:", JSON.stringify(data.data));
            
            // 修改VIP相关字段
            data.data.is_vip = 1;                    // 设置为VIP用户
            data.data.is_try_vip = 1;                // 设置为试用VIP
            data.data.vip_days = 999999;                // VIP天数
            data.data.vip_expire = "2026-12-31 23:59:59";  // VIP过期时间
            data.data.try_vip_expire = "2026-12-31 23:59:59"; // 试用VIP过期时间
            data.data.word_level = "六级";            // 单词等级
            data.data.buy_term_count = 999;           // 购买数量
            
            // 如果有其他字段也可以修改
            if (data.data.recent_vip_avatars) {
                // 保持原有头像不变
            }
            
            console.log("修改后的数据:", JSON.stringify(data.data));
            return JSON.stringify(data);
        }
        
        return body;
    } catch (e) {
        console.log("解析失败:", e);
        return body;
    }
}

// 主函数
function onResponse(context) {
    let body = $response.body;
    
    if (body) {
        console.log("拦截到响应，长度:", body.length);
        let modifiedBody = modifyUserInfo(body);
        $done({body: modifiedBody});
    } else {
        $done({});
    }
}

onResponse();