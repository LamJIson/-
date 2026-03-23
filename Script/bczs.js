// 百词斩阅读 - 最终版（直接提供内容，不依赖 get_article_data）

let url = $request.url;

// ========== 1. 处理 get_book_article 接口（核心） ==========
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
            
            // 关键：构造一个有效的内容结构，让 App 直接显示
            if (data.article_info === null) {
                // 从章节列表或本地构造一个简单内容
                data.article_info = {
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
                                        text: "This content is unlocked.",
                                        translate: "此内容已解锁。",
                                        words: []
                                    }
                                ]
                            }
                        ]
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
            // 保持 isDone 为 0，不要改 1
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }
    } catch (e) {
        console.log("百词斩: get_user_read_book错误 - " + e.message);
        $done({});
    }
}

// ========== 4. 其他接口 ==========
else {
    $done({});
}