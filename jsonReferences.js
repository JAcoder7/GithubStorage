// @ts-check

/**
 * 
 * @param {{ [key: string]: any }} obj 
 * @param {object|undefined} root 
 * @returns {object}
 */
export function serializeReferences(obj, root = undefined) {
    /** @type {{ [key: string]: any }} */
    let clone = structuredClone(obj)

    for (const key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) {
            if (key.startsWith("$")) {
                clone[key] = findObjectPath(obj[key], root || obj)
                if (clone[key] == null) {
                    throw new Error(`Cant find object reference '${key}'`)
                }
            } else if (typeof obj[key] == "object" && obj[key] !== null) {
                clone[key] = serializeReferences(obj[key], root || obj)
            }
        }
    }
    return clone
}

/**
 * 
 * @param {object} obj 
 * @param {object} parentObj 
 * @returns 
 */
export function findObjectPath(obj, parentObj) {
    for (const key in parentObj) {
        if (Object.hasOwnProperty.call(parentObj, key)) {
            if (!key.startsWith("$")) {
                if (obj === parentObj[key]) {
                    return key;
                } else if (typeof parentObj[key] == "object" && obj[key] !== null) {
                    let res = findObjectPath(obj, parentObj[key])
                    if (res !== null) {
                        return [key, ...res]
                    }
                }
            }
        }
    }
    return null
}
function getAtPath(obj, path) {
    for (const key of path) {
        if (obj == null) {
            return null
        }
        obj = obj[key];
    }
    return obj
}
export function deserializeReferences(obj, root) {
    let clone = root ? obj : structuredClone(obj)
    for (const key in clone) {
        if (Object.hasOwnProperty.call(clone, key)) {
            if (key.startsWith("$")) {
                const path = clone[key]
                clone[key] = getAtPath(root || clone, path)
                if (clone[key] == null) {
                    throw new Error(`Cant find object reference '${key}' at path '${path}' in '${JSON.stringify(clone)}'`)
                }
            } else if (typeof clone[key] == "object" && clone[key] !== null) {
                clone[key] = deserializeReferences(clone[key], root || clone)
            }
        }
    }
    return clone
}
