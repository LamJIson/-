// 百词斩阅读 - 解锁会员书籍（修复版）

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
                    book.free_trial_count = 999;
                }
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: 套装接口错误 - " + e.message);
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
            data.buy_type = [2];
            data.free_trial_count = 999;
            data.can_free_trial = 1;
            
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
        console.log("百词斩: 单书接口错误 - " + e.message);
        $done({});
    }
}

// ========== 3. 处理章节内容接口（核心修复） ==========
else if (url.includes("/api/ireading/new_reading/get_book_article")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // ========== 核心修复 ==========
            // 1. 允许阅读当前章节
            data.can_read = 1;
            
            // 2. 告诉 App 有下一章（如果章节数足够）
            // 获取当前章节号，判断是否有下一章
            let currentChapter = data.chapter || 1;
            let totalChapters = data.book ? data.book.chapter_count : 3;
            
            if (currentChapter < totalChapters) {
                data.has_next_article = true;
                data.next_article_is_online = true;
            } else {
                // 最后一章保持 false
                data.has_next_article = false;
                data.next_article_is_online = false;
            }
            
            // 3. 解锁其他权限字段
            if (data.is_locked !== undefined) data.is_locked = false;
            if (data.need_pay !== undefined) data.need_pay = false;
            if (data.is_free !== undefined) data.is_free = true;
            
            // 4. 修改 book 对象
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
                data.book.has_read_service = 1;
                data.book.free_trial_count = 999;
                data.book.can_free_trial = 1;
            }
            
            // 5. 如果 article_info 为 null，保留 null（内容加载可能走其他接口）
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: get_book_article错误 - " + e.message);
        $done({});
    }
}

// ========== 4. 处理 get_article_data 接口 ==========
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
        console.log("百词斩: get_article_data错误 - " + e.message);
        $done({});
    }
}

// ========== 5. 其他接口直接放行 ==========
else {
    $done({});
}