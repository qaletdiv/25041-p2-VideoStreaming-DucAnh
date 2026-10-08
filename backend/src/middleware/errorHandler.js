import { HttpError } from '../lib/httpError.js';

// Express nhận ra error handler nhờ đúng 4 tham số, đừng bỏ `next`
export function errorHandler(err, req, res, next) {
    // Lỗi có chủ đích do code của mình ném ra
    if (err instanceof HttpError) {
        return res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
                ...(err.fields && { fields: err.fields }),
            },
        });
    }

    // JSON gửi lên bị hỏng
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: { code: 'INVALID_JSON', message: 'Invalid JSON body' },
        });
    }

    // Lỗi 4xx do thư viện (ví dụ body quá lớn): an toàn để báo cho client
    if (err.status >= 400 && err.status < 500 && err.expose) {
        return res.status(err.status).json({
            error: { code: 'BAD_REQUEST', message: err.message },
        });
    }

    // Mọi thứ còn lại là lỗi bất ngờ: chỉ ghi log, không lộ chi tiết
    console.error('[error]', err);
    res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
}