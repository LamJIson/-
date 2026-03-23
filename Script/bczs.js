// 百词斩阅读 - 解锁会员书籍（完整版）
// 支持 get_book_package_info, get_book_info, get_article_data

let url = $request.url;

// ========== 1. 处理套装详情接口 ==========
if (url.includes("/api/ireading/new_reading/get_book_package_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 标记套装已购买
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            
            // 解锁套装内的每一本书
            if (data.books && Array.isArray(data.books)) {
                for (let book of data.books) {
                    book.buy_status = 1;
                    book.has_read_service = 1;
                    book.is_restricted = 0;
                    // 关键：将 buy_type 从 [1] 改为 [2]
                    book.buy_type = [2];
                }
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: 套装接口错误 - " + e.message);
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
            
            // 标记已购买
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            data.free_trial_count = 999;
            data.can_free_trial = 1;
            
            // 关键：将 buy_type 从 [1] 改为 [2]
            data.buy_type = [2];
            
            // 解锁章节列表
            if (data.chapter_simple_info && Array.isArray(data.chapter_simple_info)) {
                for (let chapter of data.chapter_simple_info) {
                    chapter.is_locked = false;
                    chapter.is_free = true;
                    chapter.need_pay = false;
                }
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: 单书接口错误 - " + e.message);
        $done({});
    }
}

// ========== 3. 处理章节内容接口（核心！） ==========
else if (url.includes("/api/ireading/new_reading/get_article_data")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 核心解锁：添加 can_read 字段（会员响应中有此字段）
            data.can_read = 1;
            
            // 同时解锁可能存在的其他权限字段
            if (data.is_locked !== undefined) data.is_locked = false;
            if (data.need_pay !== undefined) data.need_pay = false;
            if (data.is_free !== undefined) data.is_free = true;
            
            // 如果有 book 嵌套对象，也解锁
            if (data.book) {
                data.book.buy_status = 1;
                data.book.has_read_service = 1;
                data.book.free_trial_count = 999;
                data.book.can_free_trial = 1;
                // 关键：将 book 中的 buy_type 也改为 [2]
                data.book.buy_type = [2];
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: 章节内容接口错误 - " + e.message);
        $done({});
    }
}

// ========== 4. 其他接口直接放行 ==========
else {
    $done({});
}