import crypto from 'crypto';

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                acc[key] = canonicalize(value[key]);
                return acc;
            }, {});
    }
    return value;
}

// Stable sha256 over a JSON value: object keys are sorted recursively first,
// so two objects with the same content but different key order hash the same.
export function sha256Json(value) {
    const canonical = JSON.stringify(canonicalize(value));
    return crypto.createHash('sha256').update(canonical).digest('hex');
}
