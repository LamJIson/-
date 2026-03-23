// 百词斩阅读 - 解锁会员书籍（双接口完整版）

let url = $request.url;

// ========== 1. 套装详情接口 ==========
if (url.includes("/api/ireading/new_reading/get_book_package_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            data.book_package_buy_status = 1;
            
            if (data.books && data.books.length > 0) {
                for (let book of data.books) {
                    book.buy_status = 1;
                    book.has_read_service = 1;
                    book.buy_type = [2];
                    book.free_trial_count = 999;
                    book.is_in_bookshelf = 1;
                    book.reading_mode = 1;
                }
            }
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: 套装接口错误 - " + e.message);
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
            data.buy_status = 1;
            data.buy_type = [2];
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            data.free_trial_count = 999;
            data.can_free_trial = 1;
            data.reading_mode = 1;
            data.book_package_buy_status = 1;
            
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
        console.log("百词斩: 单书接口错误 - " + e.message);
        $done({});
    }
}

// ========== 3. 处理 get_book_article 接口 ==========
else if (url.includes("/api/ireading/new_reading/get_book_article")) {
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
                data.book.book_package_buy_status = 1;
            }
            
            // 解锁其他字段
            if (data.is_locked !== undefined) data.is_locked = false;
            if (data.need_pay !== undefined) data.need_pay = false;
            if (data.is_free !== undefined) data.is_free = true;
            
            $done({ body: JSON.stringify(obj) });
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
            
            // 核心修改
            data.can_read = 1;
            data.is_in_bookshelf = 1;
            data.reading_mode = 1;
            
            // 关键：设置下一章可用
            let hasNext = false;
            
            // 方法1：从 book.chapter_simple_info 判断
            if (data.book && data.book.chapter_simple_info && Array.isArray(data.book.chapter_simple_info)) {
                let chapters = data.book.chapter_simple_info;
                let currentId = data.id;
                let currentIndex = chapters.findIndex(ch => ch.chapter_id === currentId);
                if (currentIndex !== -1 && currentIndex < chapters.length - 1) {
                    hasNext = true;
                }
            }
            
            // 方法2：如果有 has_next_article 字段，直接设为 true
            // 方法3：如果章节数已知，根据当前 chapter 判断
            if (!hasNext && data.chapter && data.book && data.book.chapter_count) {
                if (data.chapter < data.book.chapter_count) {
                    hasNext = true;
                }
            }
            
            // 默认设为 true（让 App 尝试加载）
            data.has_next_article = hasNext || true;
            data.next_article_is_online = hasNext || true;
            
            // 修改 book 对象
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
                data.book.is_in_bookshelf = 1;
                data.book.reading_mode = 1;
                data.book.book_package_buy_status = 1;
                data.book.free_trial_count = 999;
                data.book.can_free_trial = 1;
            }
            
            // 解锁其他字段
            if (data.is_locked !== undefined) data.is_locked = false;
            if (data.need_pay !== undefined) data.need_pay = false;
            if (data.is_free !== undefined) data.is_free = true;
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: get_article_data错误 - " + e.message);
        $done({});
    }
}

// ========== 5. 其他接口 ==========
else {
    $done({});
}