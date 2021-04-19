//using for file stream
import * as fs from 'fs';

/**
 * reading file and poll each line
 * 
 * reference: [n-readlines](https://github.com/nacholibre/node-readlines)
 */
export class ReadLinesSync implements Iterable<{ lineNo: number, line: Buffer | undefined }> {

    /** the token/handle of file stream */
    private fileToken?: number;
    /** point whether reach the end of file */
    private eof: boolean;
    /** buffer/cache when reading */
    private cache: Buffer[];
    /** the index of current reading buffer */
    private pos: number;
    /** the size of reading a chunk */
    private readonly chunkSize: number;
    /** the char point to end of line */
    private endChar: number;

    /**
     * construct a new reader
     * @param file the file path to read
     * @param option reading options
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
     * find the index of specific data in buffer
     * @param buf the buffer to search
     * @param data the data specified
     */
    private searchInBuffer(buf: Buffer, data: number): number {
        return buf.indexOf(data);
    }

    /**
     * get a slice in buffer according to the end of line character
     * @param buf the buffer to slice
     */
    private extractLines(buf: Buffer): Buffer[] {
        /* variable initialize */
        let curPos = 0;             //the position/index of buffer
        let lastEOL = 0;            //the index of previous eol
        let line: Buffer;           //temporarily store the data from last eol to new eol
        const lines: Buffer[] = []; //the return buffer

        /* poll each data in buffer to find eol */
        while (true) {
            /* get latest data */
            let value = buf[curPos++];
            /* add to result buffer when eol is found */
            if (value === this.endChar) {
                line = buf.slice(lastEOL, curPos);
                lines.push(line);
                lastEOL = curPos;
            } else if (!value) {
                break;
            }
        }

        /* add the remaining buffer if no eol found but reach the end of file stream */
        line = buf.slice(lastEOL, curPos);
        if (line.length) {
            lines.push(line);
        }

        /* retuen found lines */
        return lines;
    }

    /**
     * trying to read one line
     * @param leftovers the remaining buffer after last read
     */
    private readChunk(leftovers?: Buffer): number {
        /* variable initialize */
        let totalBytesRead = 0;         //the count of how many bytes are read
        let bytesRead = 0;              //the count of how many bytes before eol
        let buf: Buffer;                //temporary buffer
        const buffers: Buffer[] = [];   //the accumulated buffer. may larger than 1024.

        /* ensure open file successfully */
        if (this.fileToken) {
            /* loop to the end of stream or eol found */
            do {
                /* allocate a new buffer to read */
                buf = Buffer.alloc(this.chunkSize);
                /* read from file into buf */
                bytesRead = fs.readSync(this.fileToken, buf, 0, this.chunkSize, this.pos);
                /* store how many bytes are read in total */
                totalBytesRead += bytesRead;
                /* shift the reading index */
                this.pos += bytesRead;
                /* add into buffers */
                buffers.push(buf);
            } while (bytesRead && this.searchInBuffer(buf, this.endChar) === -1);
        }

        /* combine all buffers that found */
        let data = Buffer.concat(buffers);
        /* reach the end of file if length less than chunk */
        if (bytesRead < this.chunkSize) {
            this.eof = true;
            data = data.slice(0, totalBytesRead);   //get the useful parts
        }
        /* get the slice if eol found */
        if (totalBytesRead) {
            /* get a slice of one line */
            this.cache = this.extractLines(data);
            /* add to cache[0] if remaining data exists */
            if (leftovers) {
                this.cache[0] = Buffer.concat([leftovers, this.cache[0]]);
            }
        }
        /* return how many bytes are read. */
        return totalBytesRead;
    }

    /**
     * reset reader
     */
    public reset() {
        this.eof = false;
        this.cache = [];
        this.pos = 0;
    }

    /**
     * close and release file token
     */
    public close() {
        if (this.fileToken) {
            fs.closeSync(this.fileToken);
            this.fileToken = undefined;
        }
    }

    /**
     * get next line text
     */
    public getNextLine(): Buffer | undefined {
        /* return null if file was not opened */
        if (!this.fileToken) {
            return undefined;
        }
        /* return null if reach the end of file or read failed */
        if (this.eof && this.cache.length === 0) {
            return undefined;
        }
        /* make a temporary to store line */
        let line: Buffer | undefined;
        /* read a chunk from file if cache is empty */
        let bytesRead = 0;
        if (!this.cache.length) {
            bytesRead = this.readChunk();
        }
        /* get the line content if cached something  */
        if (this.cache.length) {
            /* get first line in the cache (dequeue) */
            line = this.cache.shift();
            if (line) {
                /* gets and checks the last character */
                const lastChar = line[line.length - 1];
                /* cache[0] is the remaining data if lastChar was not eol.
                   read next chunk and concat remaining data */
                if (lastChar !== this.endChar) {
                    bytesRead = this.readChunk(line);
                    if (bytesRead) {
                        line = this.cache.shift();
                    }
                }
            }
        }
        /* close file if reach the end of file */
        if (this.eof && this.cache.length === 0) {
            this.close();
        }
        /* get the slice without eol if found sucessfully */
        if (line && line[line.length - 1] === this.endChar) {
            line = line.slice(0, line.length - 1);
        }
        /* return the line */
        return line;
    }

    /**
     * get iterator
     */
    *[Symbol.iterator]() {
        /* declare for line numer */
        let lineNo = 0;
        /* poll each line until reach the end of file */
        while (!this.eof || this.cache.length > 0) {
            /* yield the line number and content */
            yield { lineNo: lineNo++, line: this.getNextLine() };
        }
    }

}