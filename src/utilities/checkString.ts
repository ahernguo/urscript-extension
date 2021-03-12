/**
 * check the string is null, undefined or fill with spaces
 * @param value the string to check
 * @returns (true)empty   (false)not empty
 */
export function isBlank(value: string): boolean {
    /* ensure value is not undefined and not empty */
    if (value && value !== '') {
        /* using regex to check content is only spaces? */
        return /^\s*$/.test(value);
    } else {
        return true;
    }
}