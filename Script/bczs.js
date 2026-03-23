// 百词斩阅读 - 解锁会员书籍
// 支持接口：get_book_package_info, get_book_info, get_book_article, get_article_data

let url = $request.url;

// ========== 1. 套装详情接口 ==========
if (url.includes("/api/ireading/new_reading/get_book_package_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 修改套装状态
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            
            // 修改套装内每本书
            if (data.books && data.books.length > 0) {
                for (let book of data.books) {
                    book.buy_status = 1;
                    book.has_read_service = 1;
                    book.buy_type = [2];
                    book.free_trial_count = 999;
                }
            }
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: 套装接口错误 - " + e.message);
        $done({});
    }
}

// ========== 2. 单书详情接口 ==========
else if (url.includes("/api/ireading/new_reading/get_book_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 修改购买状态
            data.buy_status = 1;
            data.buy_type = [2];
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            data.free_trial_count = 999;
            data.can_free_trial = 1;
            
            // 解锁章节列表
            if (data.chapter_simple_info && data.chapter_simple_info.length > 0) {
                for (let chapter of data.chapter_simple_info) {
                    chapter.is_locked = false;
                    chapter.is_free = true;
                }
            }
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: 单书接口错误 - " + e.message);
        $done({});
    }
}

// ========== 3. 章节内容接口（最核心） ==========
else if (url.includes("/api/ireading/new_reading/get_book_article")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // ===== 核心修复 =====
            // 1. 允许阅读当前章节
            data.can_read = 1;
            
            // 2. 设置下一章可用（根据当前章节号判断）
            let currentChapter = data.chapter || 1;
            let totalChapters = data.book ? data.book.chapter_count : 0;
            
            if (totalChapters > 0 && currentChapter < totalChapters) {
                data.has_next_article = true;
                data.next_article_is_online = true;
            } else {
                // 如果是最后一章或无法获取总数，保持原值或设为false
                data.has_next_article = false;
                data.next_article_is_online = false;
            }
            
            // 3. 修改 book 对象
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
                data.book.has_read_service = 1;
                data.book.free_trial_count = 999;
                data.book.can_free_trial = 1;
            }
            
            // 4. 解锁其他可能的权限字段
            if (data.is_locked !== undefined) data.is_locked = false;
            if (data.need_pay !== undefined) data.need_pay = false;
            if (data.is_free !== undefined) data.is_free = true;
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: 章节接口错误 - " + e.message);
        $done({});
    }
}

// ========== 4. 备用章节内容接口 ==========
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
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩解锁: get_article_data错误 - " + e.message);
        $done({});
    }
}

// ========== 5. 其他接口 ==========
else {
    $done({});
}