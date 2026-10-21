import { createHash } from 'node:crypto';

// Ký upload Cloudinary: sắp xếp key, nối "key=value" bằng &, rồi sha1 hex với API Secret
export function signUploadParams(params, apiSecret) {
    const payload = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');
    return createHash('sha1').update(payload + apiSecret).digest('hex');
}
