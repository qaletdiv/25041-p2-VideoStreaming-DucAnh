export function errorHandler(err, req, res, next) {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: { code: 'INVALID_JSON', message: 'Invalid JSON body' },
        });
    }

    const status = err.status || 500;

    if (status >= 500) {
        console.error('[error]', err);
    }

    res.status(status).json({
        error: {
            code: err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
            message: status >= 500 ? 'Internal server error' : err.message,
        },
    });
}