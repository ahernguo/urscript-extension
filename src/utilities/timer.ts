/**
 * 簡易計時器
 */
export function timer() {

    /**
     * 開始記錄之時間
     */
    const startTime = new Date().getTime();

    return {
        /** 取得已經過的秒數 */
        get seconds() {
            const curTime = new Date().getTime();
            const subTime = (curTime - startTime) / 1000;
            return Math.ceil(subTime);
        },
        /** 取得已經過的毫秒數 */
        get ms() {
            const curTime = new Date().getTime();
            return curTime - startTime;
        }
    };
}