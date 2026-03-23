// 百词斩阅读 - 解锁会员书籍
// 适用接口: /api/ireading/new_reading/get_book_info

let url = $request.url;
let method = $request.method;

// 只处理书籍详情接口
if (url.includes("/api/ireading/new_reading/get_book_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        // 如果返回成功且有数据
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // ========== 1. 解锁试读限制 ==========
            // 将免费试读章节数改为99章（足够覆盖所有书）
            data.free_trial_count = 999;
            data.can_free_trial = 1;
            
            // ========== 2. 修改购买/会员状态 ==========
            // 设置已购买状态
            data.buy_status = 1;
            // 如果有 is_in_bookshelf 字段，设为已在书架
            if (data.is_in_bookshelf !== undefined) {
                data.is_in_bookshelf = 1;
            }
            // 如果有 has_read_service 字段
            if (data.has_read_service !== undefined) {
                data.has_read_service = 1;
            }
            
            // ========== 3. 解锁所有章节 ==========
            if (data.chapter_simple_info && Array.isArray(data.chapter_simple_info)) {
                for (let chapter of data.chapter_simple_info) {
                    // 常见字段：是否锁定、是否需要付费
                    chapter.is_locked = false;
                    chapter.is_free = true;
                    chapter.need_pay = false;
                    chapter.can_preview = true;
                }
            }
            
            // ========== 4. 修改章节总数（如果有） ==========
            // 确保所有章节都可读
            if (data.chapter_count) {
                // 保持原样，只解锁不修改数量
            }
            
            // ========== 5. 其他可能的权限字段 ==========
            // 根据你之前提供的 JSON，可能还有这些字段
            if (data.is_restricted !== undefined) {
                data.is_restricted = 0;
            }
            if (data.is_gold_service !== undefined) {
                data.is_gold_service = 1;
            }
            
            // ========== 6. 修改套装/购买相关 ==========
            if (data.book_package_buy_status !== undefined) {
                data.book_package_buy_status = 1;
            }
            
            // 重新生成响应
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            // 无数据或接口返回错误，直接放行
            $done({});
        }
    } catch (e) {
        // 解析失败，直接放行
        console.log("百词斩解锁脚本错误: " + e.message);
        $done({});
    }
} else {
    // 不是目标接口，直接放行
    $done({});
}