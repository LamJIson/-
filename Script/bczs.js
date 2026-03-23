// 百词斩阅读 - 解锁会员书籍（最终汇总版）

let url = $request.url;

// ========== 1. 处理套装详情接口 ==========
if (url.includes("/api/ireading/new_reading/get_book_package_info")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 修改套装级别字段
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            
            // 修改套装内每一本书的字段
            if (data.books && Array.isArray(data.books)) {
                for (let book of data.books) {
                    book.buy_status = 1;
                    book.has_read_service = 1;
                    book.buy_type = [2];
                    if (book.is_restricted !== undefined) book.is_restricted = 0;
                    if (book.free_trial_count !== undefined) book.free_trial_count = 999;
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
            
            // 修改单书权限字段
            data.buy_status = 1;
            data.is_in_bookshelf = 1;
            data.has_read_service = 1;
            data.buy_type = [2];
            data.free_trial_count = 999;
            data.can_free_trial = 1;
            
            // 修改章节列表中的权限
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
        console.log("百词斩: 单书接口错误 - " + e.message);
        $done({});
    }
}

// ========== 3. 处理章节内容接口（最核心！） ==========
else if (url.includes("/api/ireading/new_reading/get_book_article")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 核心解锁：将 can_read 改为 1
            data.can_read = 1;
            
            // 解锁可能存在的其他权限字段
            if (data.is_locked !== undefined) data.is_locked = false;
            if (data.need_pay !== undefined) data.need_pay = false;
            if (data.is_free !== undefined) data.is_free = true;
            
            // 修改 book 对象中的权限
            if (data.book) {
                data.book.buy_type = [2];
                data.book.buy_status = 1;
                data.book.has_read_service = 1;
                data.book.free_trial_count = 999;
                data.book.can_free_trial = 1;
            }
            
            // 注意：article_info 为 null 是正常的，不需要修改
            
            let newBody = JSON.stringify(obj);
            $done({ body: newBody });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: 章节接口错误 - " + e.message);
        $done({});
    }
}

// ========== 4. 处理 get_article_data 接口（备用） ==========
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