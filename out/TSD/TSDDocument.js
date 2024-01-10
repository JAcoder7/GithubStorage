import { TSDParser } from "./TSDParser.js";
export class TSDDocument {
    dataStr = null;
    root = null;
    constructor(str) {
        this.parseFromString(str);
    }
    parseFromString(str) {
        this.dataStr = str;
        this.root = TSDParser.parse(str);
    }
    toString(compact = false) {
        return this.root?.toString(compact) || null;
    }
    query(path) {
        return this.root?.query(path);
    }
    /**
     * same as .query()
     */
    q(path) {
        return this.root?.query(path);
    }
}
