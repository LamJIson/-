// 百词斩阅读 - 解锁会员书籍和套装
// 支持 get_book_package_info 和 get_book_info 接口

let url = $request.url;

// ========== 1. 处理套装详情接口 ==========
if (url.includes("/api/ireading/new_reading/get_book_package_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 修改套装购买状态
            data.buy_status = 1;              // 已购买
            data.is_in_bookshelf = 1;          // 加入书架
            data.has_read_service = 1;          // 拥有阅读权限
            
            // 解锁套装内的每一本书
            if (data.books && Array.isArray(data.books)) {
                for (let book of data.books) {
                    book.buy_status = 1;
                    book.has_read_service = 1;
                    book.is_read_over = 0;      // 未读完（可继续读）
                    
                    // 如果有其他权限相关字段
                    if (book.is_restricted !== undefined) {
                        book.is_restricted = 0;
                    }
                    if (book.can_preview !== undefined) {
                        book.can_preview = true;
                    }
                }
            }
            
            // 修改奖励和进度相关（可选）
            data.edit_award = 1;
            if (data.finish_gift && Array.isArray(data.finish_gift)) {
                // 保留原奖励
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("解锁套装接口错误: " + e.message);
        $done({});
    }
}

// ========== 2. 处理单书详情接口 ==========
else if (url.includes("/api/ireading/new_reading/get_book_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 修改单书权限
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            data.free_trial_count = 999;      // 试读章节数设为大数
            data.can_free_trial = 1;
            
            // 解锁章节列表
            if (data.chapter_simple_info && Array.isArray(data.chapter_simple_info)) {
                for (let chapter of data.chapter_simple_info) {
                    chapter.is_locked = false;
                    chapter.is_free = true;
                    chapter.need_pay = false;
                    chapter.can_preview = true;
                }
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("解锁单书接口错误: " + e.message);
        $done({});
    }
}

// ========== 3. 其他接口直接放行 ==========
else {
    $done({});
}