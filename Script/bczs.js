// 百词斩阅读 - 最终版（确保内容加载）

let url = $request.url;

// ========== 1. 处理 get_book_article 接口 ==========
if (url.includes("/api/ireading/new_reading/get_book_article")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 核心修改
            data.can_read = 1;
            data.is_in_bookshelf = 1;
            data.reading_mode = 1;
            
            // 设置下一章可用
            let currentChapter = data.chapter || 1;
            let totalChapters = data.book ? data.book.chapter_count : 0;
            if (totalChapters > 0 && currentChapter < totalChapters) {
                data.has_next_article = true;
                data.next_article_is_online = true;
            }
            
            // 修改 book 对象
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
                data.book.has_read_service = 1;
                data.book.free_trial_count = 999;
                data.book.can_free_trial = 1;
                data.book.is_in_bookshelf = 1;
                data.book.reading_mode = 1;
            }
            
            // 重要：保持 article_info 为 null，让 App 去请求 get_article_data
            // 不修改 article_info
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: get_book_article错误 - " + e.message);
        $done({});
    }
}

// ========== 2. 处理 get_article_data 接口（实际内容） ==========
else if (url.includes("/api/ireading/new_reading/get_article_data")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 确保内容可读
            data.can_read = 1;
            data.is_in_bookshelf = 1;
            data.reading_mode = 1;
            
            // 设置下一章可用
            data.has_next_article = true;
            data.next_article_is_online = true;
            
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
                data.book.is_in_bookshelf = 1;
                data.book.reading_mode = 1;
            }
            
            // article_info 已经有完整内容，保持不变
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: get_article_data错误 - " + e.message);
        $done({});
    }
}

// ========== 3. 其他接口 ==========
else {
    $done({});
}