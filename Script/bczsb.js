let body = $response.body;
let obj = JSON.parse(body);

// Modify the response to unlock all chapters and content
obj.data.buy_status = 0; // Set buy_status to 0 to indicate the book is accessible
obj.data.can_free_trial = 1; // Ensure free trial is available
obj.data.is_in_bookshelf = 1; // Optionally, add the book to the bookshelf
obj.data.has_read_service = 1; // Enable read service if applicable
obj.data.is_restricted = 0; // Remove any restrictions

// Ensure all chapters are accessible
if (obj.data.chapter_simple_info) {
  obj.data.chapter_simple_info.forEach(chapter => {
    chapter.can_free_trial = 1; // Ensure each chapter can be accessed
    chapter.buy_status = 0; // Mark each chapter as accessible
  });
}

// Ensure the book is marked as purchased or available
obj.data.buy_type = [1]; // Assuming 1 indicates purchased or available

// Ensure the book is marked as fully accessible
obj.data.update_status = 0; // Assuming 0 indicates fully accessible

$done({body: JSON.stringify(obj)});
