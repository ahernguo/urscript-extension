//用於檔案載入與解析
import * as fs from 'fs';

/**
 * 讀取檔案並每次回傳一行的讀取器
 * 
 * 此內容改版自 [n-readlines](https://github.com/nacholibre/node-readlines)
 */
export class ReadLinesSync implements Iterable<{ lineNo: number, line: Buffer | undefined }> {

    /** 開啟檔案的 Token */
    private fileToken?: number;
    /** 指出是否已到達檔案結尾(End Of File) */
    private eof: boolean;
    /** 暫存區 */
    private cache: Buffer[];
    /** 當前的緩衝區索引 */
    private pos: number;
    /** 每次讀取的緩衝區大小 */
    private readonly chunkSize: number;
    /** 欲判斷的結尾符號 */
    private endChar: number;

    /**
     * 建構同步的行讀取器
     * @param file 檔案路徑
     * @param option 選項參數
     */
    constructor(file: fs.PathLike, option: { readChunk: number, endChar: number } = { readChunk: 1024, endChar: 0x0A }) {
        this.chunkSize = option.readChunk;
        this.endChar = option.endChar;
        this.fileToken = fs.openSync(file, 'r');
        this.eof = false;
        this.cache = [];
        this.pos = 0;
    }

    /**
     * 尋找緩衝區中指定資料之索引
     * @param buf 欲尋找的緩衝區
     * @param data 欲尋找的資料
     */
    private searchInBuffer(buf: Buffer, data: number): number {
        return buf.indexOf(data);
    }

    /**
     * 將緩衝區內的資料依照結尾符號給分段拆出
     * @param buf 欲解析的緩衝區資料
     */
    private extractLines(buf: Buffer): Buffer[] {
        /* 初始化變數 */
        let curPos = 0;             //Buffer內的位移索引
        let lastEOL = 0;            //上一次出現的結尾符號索引
        let line: Buffer;           //暫存上次的結尾到此次新結尾符號的資料
        const lines: Buffer[] = []; //回傳的集合

        /* 輪詢緩衝區內的資料，找出結尾符號 */
        while (true) {
            /* 取得一筆資料 */
            let value = buf[curPos++];
            /* 如果是結尾，加入要回傳的清單 */
            if (value === this.endChar) {
                line = buf.slice(lastEOL, curPos);
                lines.push(line);
                lastEOL = curPos;
            } else if (!value) {
                break;
            }
        }

        /* 檢查是否有剩餘的項目 */
        line = buf.slice(lastEOL, curPos);
        if (line.length) {
            lines.push(line);
        }

        /* 回傳 */
        return lines;
    }

    /**
     * 嘗試從檔案讀取一行
     * @param leftovers 上次剩餘的緩衝區
     */
    private readChunk(leftovers?: Buffer): number {
        /* 初始化變數 */
        let totalBytesRead = 0;         //總共已讀取多少字
        let bytesRead = 0;              //當前緩衝區於結尾符號前共有多少字
        let buf: Buffer;                //暫存當前緩衝區
        const buffers: Buffer[] = [];   //累積的緩衝區，有可能大於 1024 字才出現結尾符號

        /* 確保有開啟檔案 */
        if (this.fileToken) {
            /* 無限迴圈直至沒讀到東西或有結尾符號就離開 */
            do {
                /* 新增要存放的緩衝區 */
                buf = Buffer.alloc(this.chunkSize);
                /* 從檔案中依序讀取 */
                bytesRead = fs.readSync(this.fileToken, buf, 0, this.chunkSize, this.pos);
                /* 紀錄總共讀取多少了 */
                totalBytesRead += bytesRead;
                /* 位移 pos 索引 */
                this.pos += bytesRead;
                /* 將此段集合加入清單 */
                buffers.push(buf);
            } while (bytesRead && this.searchInBuffer(buf, this.endChar) === -1);
        }

        /* 將所有找到的串在一起 */
        let data = Buffer.concat(buffers);
        /* 如果提早結束，表示已經到達檔案尾聲 */
        if (bytesRead < this.chunkSize) {
            this.eof = true;
            data = data.slice(0, totalBytesRead);   //取出有資料的片段就好
        }
        /* 如果順利找到換行符號，擷取之 */
        if (totalBytesRead) {
            /* 把每一行給解出來 */
            this.cache = this.extractLines(data);
            /* 如果之前還有剩下的，將之加入 cache[0] */
            if (leftovers) {
                this.cache[0] = Buffer.concat([leftovers, this.cache[0]]);
            }
        }
        /* 回傳找到多少筆資料 */
        return totalBytesRead;
    }

    /**
     * 重設讀取器
     */
    public reset() {
        this.eof = false;
        this.cache = [];
        this.pos = 0;
    }

    /**
     * 關閉讀取器
     */
    public close() {
        if (this.fileToken) {
            fs.closeSync(this.fileToken);
            this.fileToken = undefined;
        }
    }

    /**
     * 取得下一行資料
     */
    public getNextLine(): Buffer | undefined {
        /* 如果沒有開啟檔案，直接離開 */
        if (!this.fileToken) {
            return undefined;
        }
        /* 如果已經到達結尾或讀取失敗，回傳結果 */
        if (this.eof && this.cache.length === 0) {
            return undefined;
        }
        /* 初始旗標 */
        let line: Buffer | undefined;
        /* 假設是一開始，直接讀取之 */
        let bytesRead = 0;
        if (!this.cache.length) {
            bytesRead = this.readChunk();
        }
        /* 若曾經有讀取過，或有上次的剩餘資料 */
        if (this.cache.length) {
            /* 如果曾經讀取過，取出第一筆(Dequeue) */
            line = this.cache.shift();
            if (line) {
                /* 檢查最後一字 */
                const lastChar = line[line.length - 1];
                /* 若不是結尾符號則繼續往後讀一次，表示當前 cache[0] 是上次剩餘的(leftovers) */
                if (lastChar !== this.endChar) {
                    bytesRead = this.readChunk(line);
                    /* 若有成功讀到，Dequeue */
                    if (bytesRead) {
                        line = this.cache.shift();
                    }
                }
            }
        }
        /* 如果已經讀完了，關閉檔案 */
        if (this.eof && this.cache.length === 0) {
            this.close();
        }
        /* 如果有成功讀到結尾符號，擷取前面不含結尾符號的片段 */
        if (line && line[line.length - 1] === this.endChar) {
            line = line.slice(0, line.length - 1);
        }
        /* 回傳 */
        return line;
    }

    /**
     * 取得迭代運算子
     */
    *[Symbol.iterator]() {
        /* 宣告行號 */
        let lineNo = 0;
        /* 輪詢每一行直至檔案讀取結束 */
        while (!this.eof || this.cache.length > 0) {
            /* 每次回傳當前的行號與行內容 */
            yield { lineNo: lineNo++, line: this.getNextLine() };
        }
    }

}