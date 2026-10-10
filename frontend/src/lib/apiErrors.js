// Mã lỗi của backend → khóa trong file dịch (auth.errors.*)
const CODE_TO_KEY = {
    INVALID_CREDENTIALS: 'invalidCredentials',
    ACCOUNT_LOCKED: 'accountLocked',
    NETWORK_ERROR: 'networkError',
};

export function toFormErrors(data) {
    const error = data?.error;

    // Lỗi theo từng ô: backend đã trả sẵn khóa lỗi (nameMin, emailTaken...)
    if (error?.fields && Object.keys(error.fields).length > 0) {
        return error.fields;
    }

    // Lỗi chung của cả form
    return { form: [CODE_TO_KEY[error?.code] ?? 'serverError'] };
}