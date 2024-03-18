// @ts-check

/**
 * @typedef {Object} Diff
 * @property {[string[], any, string?][]} changed
 * @property {[string[], string?][]} deleted
 */

/**
 * 
 * @param {{ [key: string]: any }} oldObj 
 * @param {{ [key: string]: any }} newObj 
 * @returns {Diff}
 */
export function getDiff(oldObj, newObj) {
    /** @type {[string[], any, string?][]} */
    let changed = []
    /** @type {[string[], string?][]} */
    let deleted = Object.keys(oldObj).filter(k => newObj[k] === undefined).map(k => [[k]])

    for (const key of Object.keys(newObj)) {
        if (Array.isArray(newObj[key])&&newObj[key].find(v => typeof v == "object" && v !== null) !== undefined) {
            throw new Error(`Arrays cant contain objects (key: ${key})`)
        }
        if (typeof oldObj[key] == "object" && oldObj[key] !== null && !Array.isArray(oldObj[key]) &&
            typeof newObj[key] == "object" && newObj[key] !== null && !Array.isArray(newObj[key])) {
            let res = getDiff(oldObj[key], newObj[key])
            changed.push(...res.changed.map(v => {
                v[0] = [key, ...v[0]]
                return v
            }))
            deleted.push(...res.deleted.map(v => {
                v[0] = [key, ...v[0]]
                return v
            }))
        } else if (Array.isArray(oldObj[key]) && Array.isArray(newObj[key])) {
            if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
                changed.push([[key], newObj[key]])
            }
        } else if (oldObj[key] !== newObj[key]) {
            changed.push([[key], newObj[key]])
        }
    }
    return { changed, deleted }
}

/**
 * 
 * @param {Object} obj 
 * @param {Diff} diff 
 * @returns {Object}
 */
export function applyDiff(obj, diff) {
    for (const change of diff.changed) {
        /** @type {{ [key: string]: any }} */
        let o = obj
        for (let i = 0; i < change[0].length; i++) {
            if (i == change[0].length - 1) {
                o[change[0][i]] = change[1];
            } else {
                o = o[change[0][i]]
            }
        }
    }
    for (const deletion of diff.deleted) {
        /** @type {{ [key: string]: any }} */
        let o = obj
        for (let i = 0; i < deletion[0].length; i++) {
            if (i == deletion[0].length - 1) {
                delete o[deletion[0][i]]
            } else {
                o = o[deletion[0][i]]
            }
        }
    }
    return obj
}

/**
 * 
 * @param {Diff} diff1 
 * @param {Diff} diff2 
 * @returns {Diff}
 */
export function combineDiffs(diff1, diff2) {
    return {
        changed: [...diff1.changed, ...diff2.changed],
        deleted: [...diff1.deleted, ...diff2.deleted]
    }
}

/**
 * 
 * @param {Diff} diff 
 */
export function isDiffEmpty(diff) {
    return diff.changed.length == 0 && diff.deleted.length == 0
}