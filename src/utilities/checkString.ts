/**
 * 檢查字串是否為空
 * @param value 欲檢查的字串
 */
export function isBlank(value: string): boolean {
    /* 確認字串是否有東西 */
    if (value && value !== '') {
        /* 利用 Regex 檢查字串內是否都是空格 */
        return /^\s*$/.test(value);
    } else {
        return true;
    }
}