let body = $response.body;
let obj = JSON.parse(body);

// Modify the response to unlock all VIP books
obj.data.buy_status = 1; // Set buy_status to 0 to indicate the book is not purchased
obj.data.can_free_trial = 999; // Set can_free_trial to 1 to allow free trial
obj.data.is_restricted = 0; // Set is_restricted to 0 to remove any restrictions
obj.data.has_read_service = 1; // Optionally, set has_read_service to 1 to indicate read service is available

$done({body: JSON.stringify(obj)});