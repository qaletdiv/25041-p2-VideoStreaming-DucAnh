import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';

export function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            throw new HttpError(
                400,
                'VALIDATION_ERROR',
                'Invalid request data',
                z.flattenError(result.error).fieldErrors,
            );
        }

        req.body = result.data; // dữ liệu đã chuẩn hóa, trường lạ đã bị loại
        next();
    };
}