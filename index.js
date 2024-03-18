// @ts-check
import GithubAPI from "./githubAPI.js";
import { applyDiff, combineDiffs, getDiff, isDiffEmpty } from "./jsonDiff.js";
import { deserializeReferences, serializeReferences } from "./jsonReferences.js";

export class SaveAPIGithub {
    /** @type {GithubAPI | null} */
    ghAPI = null;
    path = "";
    /** @type {string | null} */
    sha = null;

    /**
     * @param {string} token 
     * @param {string} user 
     * @param {string} repo 
     * @param {string} branch 
     */
    constructor(token, user, repo, branch = "main", path = "") {
        this.ghAPI = new GithubAPI(token, user, repo, branch);
        this.path = path
    }

    /**
     * 
     * @returns {Promise<object | null>}
     */
    async loadData() {
        if (!this.ghAPI) throw new ReferenceError("ghApi is null")
        let contentInfo = await this.ghAPI.getContentInfo(`${this.path}/data.json`).catch(() => { });
        let content = contentInfo ? this.ghAPI.b64DecodeUnicode(contentInfo.content) : "null";
        this.sha = contentInfo?.sha
        return JSON.parse(content)
    }

    /**
     * @param {object} data 
     */
    async saveData(data) {
        if (!this.ghAPI) throw new ReferenceError("ghApi is null")
        if (typeof this.sha !== "string") return Promise.reject("Cant save data: sha not loaded")
        return new Promise((resolve, reject) => {
            this.ghAPI?.updateFile(`${this.path}/data.json`, JSON.stringify(data), this.sha).catch(error => reject(error)).then(v => resolve(v))
        })
    }

    getHash() {
        /**
         * Returns a hash code from a string
         * @param  {String} str The string to hash.
         * @return {Number}    A 32bit integer
         * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
         */
        function hashCode(str) {
            let hash = 0;
            for (let i = 0, len = str.length; i < len; i++) {
                let chr = str.charCodeAt(i);
                hash = (hash << 5) - hash + chr;
                hash |= 0; // Convert to 32bit integer
            }
            return hash;
        }
        return hashCode(this.ghAPI?.token + this.ghAPI?.user + this.ghAPI?.repo + this.ghAPI?.branch + this.path).toString(16);
    }
}



/**
 * Save changes locally 
 * @param {{getHash: ()=>string}} saveAPI 
 * @param {object} obj 
 */
export function save(saveAPI, obj) {
    let newData = serializeReferences(obj)

    let cachedDiff = JSON.parse(localStorage.getItem(saveAPI.getHash() + "_diff") || '{"changed":[],"deleted":[]}');
    /** @type {object | null} */
    let cachedLoadedData = JSON.parse(localStorage.getItem(saveAPI.getHash() + "_data") || "null");
    if (cachedLoadedData == null) {
        throw new Error("Can't save changes: No data in cache")
    }
    let cachedData = cachedLoadedData ? applyDiff(cachedLoadedData, cachedDiff) : null;


    let diff = cachedData != null ? combineDiffs(cachedDiff, getDiff(cachedData, newData)) : cachedDiff;

    localStorage.setItem(saveAPI.getHash() + "_diff", JSON.stringify(diff))
}

/**
 * load data and upload local changes
 * @param {{loadData: ()=>Promise<object | null>, saveData: (data: object)=>Promise<any>, getHash: ()=>string}} saveAPI 
 * @returns {Promise<object | null>}
 */
export async function sync(saveAPI) {
    /** @type {import("./jsonDiff.js").Diff} */
    let diff = JSON.parse(localStorage.getItem(saveAPI.getHash() + "_diff") || '{"changed":[],"deleted":[]}');
    let data = (await saveAPI.loadData()) || JSON.parse(localStorage.getItem(saveAPI.getHash() + "_data") || "null")
    if (data == null) {
        return null
    }
    if (!isDiffEmpty(diff)) {
        data = applyDiff(data, diff)
        let cLength = diff.changed.length
        let dLength = diff.deleted.length
        saveAPI.saveData(data).then(() => {
            // FIXME only delete the part of diff that is uploaded not anything that might have been added in the meantime 
            /** @type {import("./jsonDiff.js").Diff | null} */
            let diff = JSON.parse(localStorage.getItem(saveAPI.getHash() + "_diff") || 'null');
            if (diff) {
                diff.changed.splice(cLength)
                diff.deleted.splice(dLength)
                localStorage.setItem(saveAPI.getHash() + "_diff", JSON.stringify(diff))
            }
        })
    }
    localStorage.setItem(saveAPI.getHash() + "_data", JSON.stringify(data))
    return deserializeReferences(data)
}
