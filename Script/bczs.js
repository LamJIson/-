// 百词斩解锁 - 调试版（打印日志）

let url = $request.url;

// 处理章节内容接口
if (url.includes("/api/ireading/new_reading/get_book_article")) {
    try {
        let body = $response.body;
        console.log("========== get_book_article 原始响应 ==========");
        console.log(body);
        
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            console.log("修改前: can_read = " + data.can_read);
            console.log("修改前: has_next_article = " + data.has_next_article);
            console.log("修改前: article_info = " + (data.article_info ? "有内容" : "null"));
            
            // 核心修改
            data.can_read = 1;
            
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
            
            data.is_in_bookshelf = 1;
            data.reading_mode = 1;
            
            console.log("修改后: can_read = " + data.can_read);
            console.log("修改后: has_next_article = " + data.has_next_article);
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            console.log("响应异常: code = " + obj.code);
            $done({});
        }
    } catch (e) {
        console.log("错误: " + e.message);
        $done({});
    }
}

// 处理 get_article_data 接口
else if (url.includes("/api/ireading/new_reading/get_article_data")) {
    try {
        let body = $response.body;
        console.log("========== get_article_data 原始响应 ==========");
        console.log(body.substring(0, 500)); // 只打印前500字符
        
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            data.can_read = 1;
            data.is_in_bookshelf = 1;
            data.reading_mode = 1;
            data.has_next_article = true;
            data.next_article_is_online = true;
            
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
                data.book.is_in_bookshelf = 1;
                data.book.reading_mode = 1;
            }
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("错误: " + e.message);
        $done({});
    }
}

// 其他接口放行
else {
    $done({});
}