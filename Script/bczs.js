// 百词斩阅读 - 最终版（修复阅读记录错误）

let url = $request.url;

// ========== 1. 处理 get_book_article 接口 ==========
if (url.includes("/api/ireading/new_reading/get_book_article")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            
            // 权限解锁
            data.can_read = 1;
            data.is_in_bookshelf = 1;
            data.reading_mode = 1;
            
            // 下一章可用
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
            
            // 构造内容结构（修复阅读记录问题）
            if (data.article_info === null) {
                data.article_info = {
                    articleId: data.id,
                    articleDetails: {
                        hasAudio: 0,
                        hasExplain: 1,
                        hasSentenceBySentenceTranslation: 1,
                        title: data.title || "",
                        title_cn: data.title_cn || "",
                        wordCount: data.words_count || 0,
                        translationOrNot: true
                    },
                    content: {
                        paragraphs: [
                            {
                                sentences: [
                                    {
                                        text: "Content is ready. You can read now.",
                                        translate: "内容已准备好，可以阅读。",
                                        words: []
                                    }
                                ]
                            }
                        ]
                    },
                    // 添加阅读记录相关字段
                    user_read_info: {
                        is_done: 0,
                        last_read_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
                        read_msec: 0
                    }
                };
            }
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: get_book_article错误 - " + e.message);
        $done({});
    }
}

// ========== 2. 处理 get_article_data 接口 ==========
else if (url.includes("/api/ireading/new_reading/get_article_data")) {
    try {
        let body = $response.body;
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
            
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: get_article_data错误 - " + e.message);
        $done({});
    }
}

// ========== 3. 处理阅读进度接口 ==========
else if (url.includes("/api/ireading/new_reading/get_user_read_book")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1 && obj.data) {
            let data = obj.data;
            data.canRead = true;
            data.vipUnlocked = true;
            // 确保阅读进度记录存在
            if (data.lastReadArticleId === undefined || data.lastReadArticleId === null) {
                // 从 URL 中获取 bookId 设置一个默认值
                let match = url.match(/bookId=(\d+)/);
                if (match) {
                    data.lastReadArticleId = 0;
                }
            }
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: get_user_read_book错误 - " + e.message);
        $done({});
    }
}

// ========== 4. 处理阅读上报接口（如果存在） ==========
else if (url.includes("/api/ireading/new_reading/report_read")) {
    try {
        let body = $response.body;
        let obj = JSON.parse(body);
        
        if (obj.code === 1) {
            // 直接返回成功，让 App 认为上报成功
            obj.code = 1;
            obj.message = "success";
            $done({ body: JSON.stringify(obj) });
        } else {
            // 如果失败，改为成功
            obj.code = 1;
            obj.message = "success";
            $done({ body: JSON.stringify(obj) });
        }
    } catch (e) {
        console.log("百词斩: report_read错误 - " + e.message);
        $done({});
    }
}

// ========== 5. 其他接口 ==========
else {
    $done({});
}