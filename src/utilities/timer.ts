/**
 * simple timer
 */
export function timer() {

    /**
     * record the start (construct) time
     */
    const startTime = new Date().getTime();

    return {
        /** get elapsed time with seconds */
        get seconds() {
            const curTime = new Date().getTime();
            const subTime = (curTime - startTime) / 1000;
            return Math.ceil(subTime);
        },
        /** get elapsed time with milliseconds (ms) */
        get ms() {
            const curTime = new Date().getTime();
            return curTime - startTime;
        }
    };
}