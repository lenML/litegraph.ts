/**
 * Fixes floating point precision issues by rounding to the nearest 12
 * decimal place. This is useful for comparing floating point numbers for
 * equality.
 * @param n the number to fix
 * @returns the fixed number
 */
export const fixFloat = (n: number) =>
    Number(Math.round((n + Number.EPSILON) * 1e12) / 1e12);
