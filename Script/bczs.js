// 百词斩阅读 - 解锁会员书籍（最终完整版）
// 支持所有章节相关接口

let url = $request.url;

// ========== 1. 处理套装详情接口 ==========
if (url.includes("/api/ireading/new_reading/get_book_package_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            
            if (data.books && Array.isArray(data.books)) {
                for (let book of data.books) {
                    book.buy_status = 1;
                    book.has_read_service = 1;
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
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            data.free_trial_count = 999;
            data.can_free_trial = 1;
            data.buy_type = [2];
            
            if (data.chapter_simple_info && Array.isArray(data.chapter_simple_info)) {
                for (let chapter of data.chapter_simple_info) {
                    chapter.is_locked = false;
                    chapter.is_free = true;
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

// ========== 3. 处理章节内容接口（get_article_data） ==========
else if (url.includes("/api/ireading/new_reading/get_article_data")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            data.can_read = 1;
            
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: get_article_data错误 - " + e.message);
        $done({});
    }
}

// ========== 4. 处理章节内容接口（get_book_article - 核心！） ==========
else if (url.includes("/api/ireading/new_reading/get_book_article")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 核心解锁：将 can_read 从 0 改为 1
            data.can_read = 1;
            
            // 解锁 book 对象
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
                data.book.has_read_service = 1;
                data.book.free_trial_count = 999;
            }
            
            // 如果 article_info 为 null，可能需要保留原样
            // 或者检查是否有其他权限字段
            if (data.article_info === null) {
                // 保持 null，让 App 加载内容
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: get_book_article错误 - " + e.message);
        $done({});
    }
}

// ========== 5. 其他接口直接放行 ==========
else {
    $done({});
}