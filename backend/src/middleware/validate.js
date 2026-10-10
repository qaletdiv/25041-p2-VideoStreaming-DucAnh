import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';

export function validate(schema, source = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            throw new HttpError(
                400,
                'VALIDATION_ERROR',
                'Invalid request data',
                z.flattenError(result.error).fieldErrors,
            );
        }

        // Express 5: req.query chỉ có getter, không gán được -> lưu vào property riêng
        if (source === 'query') {
            req.validatedQuery = result.data;
        } else {
            req[source] = result.data; // req.body ghi được bình thường
        }
        next();
    };
}