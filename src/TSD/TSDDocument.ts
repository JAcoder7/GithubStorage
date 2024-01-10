import { TSDElement } from "./TSDElement.js";
import { TSDParser } from "./TSDParser.js";


export class TSDDocument {
    private dataStr: string | null = null;
    root: TSDElement | null = null;

    constructor(str: string) {
        this.parseFromString(str);
    }

    parseFromString(str: string) {
        this.dataStr = str;
        this.root = TSDParser.parse(str);
    }

    toString(compact = false) {
        return this.root?.toString(compact) || null;
    }

    query(path: string) {
        return this.root?.query(path);
    }

    /**
     * same as .query()
     */
    q(path:string) {
        return this.root?.query(path);
    }
}
