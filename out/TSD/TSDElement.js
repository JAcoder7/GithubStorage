/**
 * Type of a TSD-Element
 * [collection, string, number, null, reference]
 */
export var TSDType;
(function (TSDType) {
    TSDType[TSDType["collection"] = 0] = "collection";
    TSDType[TSDType["string"] = 1] = "string";
    TSDType[TSDType["number"] = 2] = "number";
    TSDType[TSDType["boolean"] = 3] = "boolean";
    TSDType[TSDType["null"] = 4] = "null";
    TSDType[TSDType["reference"] = 5] = "reference";
})(TSDType || (TSDType = {}));
export class TSDElement {
    key;
    _value = null;
    _reference = null;
    removed;
    parent;
    lastModified;
    onChange = null;
    constructor(key, value, removed = false, lastModified = null, parent = null) {
        this.key = key;
        this.value = value;
        this.lastModified = lastModified;
        this.removed = removed;
        this.parent = parent;
    }
    set value(v) {
        this.setValue(v);
    }
    setValue(v, doesTriggerChangeEvent = true) {
        if (v?.constructor == this.constructor) {
            if (v.root != this.root) {
                throw new Error("Reference element does not share the same root");
            }
            this.lastModified = new Date();
            this.setReference(this.getRelativePath(v));
            if (doesTriggerChangeEvent)
                this.triggerChangeEvent();
            return;
        }
        if (v?.constructor == ([]).constructor) {
            this._value = [];
            v.forEach(element => {
                if (this._value.filter(e => e.key == element.key).length == 0) {
                    element.parent = this;
                    this._value.push(element);
                }
            });
            this.lastModified = new Date();
            if (doesTriggerChangeEvent)
                this.triggerChangeEvent();
            return;
        }
        this._value = v;
        this.lastModified = new Date();
        if (doesTriggerChangeEvent)
            this.triggerChangeEvent();
    }
    /**
     * @returns {TSDElement | TSDElement[] | string | number | boolean | null}
     */
    get value() {
        if (this._reference) {
            let ref = this.query(this._reference);
            if (!ref)
                console.error("Invalid reference:", this._reference);
            return ref || null;
        }
        if (this.getType() == TSDType.collection) {
            return this._value.filter(e => !e.removed);
        }
        return this._value;
    }
    /**
     * @returns {TSDElement | TSDElement[] | string | number | boolean | null}
     */
    get v() {
        return this.value;
    }
    /**
     * @param val {TSDElement | TSDElement[] | string | number | boolean | null}
     */
    set v(val) {
        this.value = val;
    }
    remove(doesTriggerChangeEvent = true) {
        this.removed = true;
        this.lastModified = new Date();
        if (doesTriggerChangeEvent)
            this.triggerChangeEvent();
    }
    unsetRemove(doesTriggerChangeEvent = true) {
        this.removed = false;
        this.lastModified = new Date();
        if (doesTriggerChangeEvent)
            this.triggerChangeEvent();
    }
    addElement(element, doesTriggerChangeEvent = true) {
        if (this.getType() == TSDType.collection) {
            if (!Object.keys(this._value).includes(element.key)) { // TODO: replace if element with the same key is removed
                element.parent = this;
                this._value.push(element);
                if (doesTriggerChangeEvent)
                    this.triggerChangeEvent();
            }
            else {
                throw new Error(`An element with the key '${element.key}' already exists in the collection`);
            }
        }
        else {
            throw new Error("Elements can only be added to collections");
        }
    }
    setReference(path, doesTriggerChangeEvent = true) {
        if (/^(?<val>(\.){0,2}(\/(([\p{Alphabetic}\d-]|\\.)+|\.\.))+)$/u.test(path)) {
            this._value = null;
            this._reference = path;
            this.lastModified = new Date();
            if (doesTriggerChangeEvent)
                this.triggerChangeEvent();
        }
    }
    getKeys() {
        if (this.getType() == TSDType.collection) {
            return this.value.map(e => e.key);
        }
        else {
            throw new Error("'getKeys()' is only available on a collection");
        }
    }
    /**
     * Returns the value of the first element in the collection of this elements value where predicate is true, and undefined otherwise.
     * @param predicate find calls predicate once for each element of the array, in ascending order, until it finds one where predicate returns true. If such an element is found, find immediately returns that element value. Otherwise, find returns undefined.
     * @returns
     */
    find(predicate) {
        if (this.getType() == TSDType.collection) {
            return this.value.find(predicate);
        }
        else {
            throw new Error("'find()' is only available on a collection");
        }
    }
    /**
     *
     * @returns The type of this elements value
     */
    getType() {
        if (this._reference) {
            return TSDType.reference;
        }
        switch (this._value?.constructor) {
            case "".constructor:
                return TSDType.string;
            case (0).constructor:
                return TSDType.number;
            case true.constructor:
                return TSDType.boolean;
            case [].constructor:
                return TSDType.collection;
            case undefined:
                if (this._value == null) {
                    return TSDType.null;
                }
            default:
                throw new Error(`type not supported: ${this._value}`);
        }
    }
    getTypeTree() {
        if (this.getType() == TSDType.collection) {
            let typeArr = [];
            this.value.forEach(element => {
                if (!typeArr.includes(element.getTypeTree())) {
                    typeArr.push(element.getTypeTree());
                }
            });
            return typeArr;
        }
        else {
            return TSDType[this.getType()];
        }
    }
    get root() {
        return this.findRoot();
    }
    /**
     *
     * @returns {TSDElement} The root of this element
     */
    findRoot() {
        let currentElem = this;
        while (currentElem.parent != null) {
            currentElem = currentElem.parent;
        }
        return currentElem;
    }
    /**
     * @returns {TSDElement | null}
     */
    q(path) {
        return this.query(path);
    }
    /**
     * @returns {TSDElement | null}
     */
    query(path) {
        if (!/^(?<val>(\.){0,2}(\/(([\p{Alphabetic}\d-]|\\.)+|\.\.))+)$/u.test(path)) {
            throw new SyntaxError("Invalid path:" + path);
        }
        let segments = path.split(/(?<!\\)\//g);
        if (segments[1] == "") {
            return this;
        }
        let searchOrigin;
        if (segments[0] == "") {
            searchOrigin = this.root;
        }
        else if (segments[0] == "..") {
            if (!this.parent)
                return null;
            searchOrigin = this.parent;
        }
        else {
            searchOrigin = this;
        }
        let result;
        if (segments[1] == "..") {
            result = searchOrigin.parent;
        }
        else {
            if (searchOrigin.getType() != TSDType.collection) {
                return null;
            }
            result = searchOrigin.find(v => v.key == segments[1].replace(/\\(.)/gu, "$1")) || null;
        }
        if (segments.length > 2) {
            return result?.query("./" + segments.slice(2).join("/")) || null;
        }
        else {
            return result;
        }
    }
    /**
     * get the relative path from this element to an other element
     */
    getRelativePath(other) {
        let path = other.getPath().split(/(?<!\\)\//g);
        let ownPath = this.getPath().split(/(?<!\\)\//g);
        let i = 0;
        while (i < path.length && i < ownPath.length && path[i] === ownPath[i]) {
            i++;
        }
        return ownPath.slice(i).map(() => "..").join("/") + "/" + path.slice(i).join("/");
    }
    /**
     *
     * @returns The path from the root to this element
     */
    getPath() {
        if (this.parent == null) {
            return "/";
        }
        let currentPath = "";
        let currentElem = this;
        while (currentElem.parent != null) {
            currentPath = "/" + currentElem.key.replace(/[^\p{Alphabetic}\d-]/gu, "\\$&") + currentPath;
            currentElem = currentElem.parent;
        }
        return currentPath;
    }
    propagateChange() {
        if (this.parent?.onChange) {
            this.parent?.onChange();
        }
        this.parent?.propagateChange();
    }
    triggerChangeEvent() {
        this.propagateChange();
        if (this.onChange) {
            this.onChange();
        }
    }
    /**
     *
     * @returns {boolean} Boolean which indicates if changes to this object were made
     */
    merge(other, debug = false, debugBit = 0) {
        // Only this timestamp
        if (this.lastModified != null && other.lastModified == null) {
            if (debug)
                this.lastModified.setTime(Math.floor(this.lastModified.getTime() / 1000) * 1000 + 110 + debugBit);
            return false;
        }
        // Only other timestamp
        if (this.lastModified == null && other.lastModified != null) {
            this.setValue(other._value, false);
            this._reference = other._reference;
            this.lastModified = other.lastModified;
            this.removed = other.removed;
            if (debug)
                this.lastModified.setTime(Math.floor(this.lastModified.getTime() / 1000) * 1000 + 220 + debugBit);
            return true;
        }
        // Timestamps equal
        if (this.lastModified?.getTime() === other.lastModified?.getTime()) {
            let changesMade = false;
            if (this.getType() == TSDType.collection && other.getType() == TSDType.collection) {
                for (const element of other._value) {
                    if (!this.getKeys().includes(element.key)) {
                        this.addElement(element, false);
                    }
                    else {
                        changesMade = this.query(`./${element.key}`)?.merge(element, debug, debugBit) || changesMade;
                    }
                }
            }
            if (debug && changesMade)
                this.lastModified?.setTime(Math.floor(this.lastModified.getTime() / 1000) * 1000 + 330 + debugBit);
            return changesMade;
        }
        // This timestamp greater
        if (this.lastModified.getTime() > other.lastModified.getTime()) {
            if (debug)
                this.lastModified?.setTime(Math.floor(this.lastModified.getTime() / 1000) * 1000 + 144);
            return false;
        }
        // Other timestamp greater
        if (this.lastModified.getTime() < other.lastModified.getTime()) {
            this.setValue(other._value, false);
            this._reference = other._reference;
            this.lastModified = other.lastModified;
            this.removed = other.removed;
            if (debug)
                this.lastModified?.setTime(Math.floor(this.lastModified.getTime() / 1000) * 1000 + 550 + debugBit);
            return true;
        }
        return false;
    }
    toString(compact = false) {
        let keyStr = this.key.replace(/[^\p{Alphabetic}\d-]/gu, "\\$&");
        let valueStr = "null";
        switch (this._value?.constructor) { // TODO: replace with this.getType()
            case "".constructor:
                valueStr = `"${this._value.replaceAll('\"', '\\\"')}"`;
                break;
            case [].constructor:
                if (compact) {
                    valueStr = `{${this._value.map(e => e.toString(compact)).join(",")}}`;
                }
                else {
                    valueStr = `{\n${this._value.map(e => `    ${e.toString(compact).split("\n").join("\n    ")}`).join(",\n")}\n}`;
                }
                break;
            case (0).constructor:
                valueStr = `${this._value}`;
                break;
            case true.constructor:
                valueStr = `${this._value}`;
                break;
            case undefined:
                if (this._value == null) {
                    valueStr = "null";
                    break;
                }
            default:
                throw new Error(`type not supported: ${this._value}`);
                break;
        }
        if (this._reference) {
            valueStr = this._reference;
        }
        let param = this.removed ? "[rem]" : "";
        if (compact) {
            let lastModifiedStr = this.lastModified == null ? "" : `|${this.lastModified.getTime()}`;
            return `${keyStr}${param}:${valueStr}${lastModifiedStr}`;
        }
        else {
            let lastModifiedStr = this.lastModified == null ? "" : `| ${this.lastModified.getTime()}`;
            return `${keyStr}${param}: ${valueStr} ${lastModifiedStr}`;
        }
    }
}
