/**
 * Type of a TSD-Element
 * [collection, string, number, null, reference]
 */
export var TSDType;
(function (TSDType) {
    TSDType[TSDType["collection"] = 0] = "collection";
    TSDType[TSDType["string"] = 1] = "string";
    TSDType[TSDType["number"] = 2] = "number";
    TSDType[TSDType["null"] = 3] = "null";
    TSDType[TSDType["reference"] = 4] = "reference";
})(TSDType || (TSDType = {}));
export class TSDElement {
    _key = "";
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
    set key(v) {
        if (/^[\w-]+$/.test(v)) {
            this._key = v;
        }
        else {
            throw new Error("Invalid key");
        }
    }
    get key() {
        return this._key;
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
    get value() {
        if (this._reference) {
            let ref = this.query(this._reference)?.value;
            if (!ref)
                console.error("Invalid reference:", this._reference);
            return ref || null;
        }
        return this._value;
    }
    addElement(element, doesTriggerChangeEvent = true) {
        if (this.getType() == TSDType.collection) {
            if (!Object.keys(this._value).includes(element.key)) {
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
        this._value = null;
        this._reference = path;
        this.lastModified = new Date();
        if (doesTriggerChangeEvent)
            this.triggerChangeEvent();
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
     * @returns The root of this element
     */
    findRoot() {
        let currentElem = this;
        while (currentElem.parent != null) {
            currentElem = currentElem.parent;
        }
        return currentElem;
    }
    query(path) {
        if (!/^(?<val>(\.){0,2}(\/(\w+|\.\.))+)$/.test(path)) {
            throw new SyntaxError("Invalid path:" + path);
        }
        let segments = path.split("/");
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
            result = searchOrigin.find(v => v.key == segments[1]) || null;
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
        let path = other.getPath();
        let ownPath = this.getPath();
        let i = 0;
        while (i < path.length && i < ownPath.length && path[i] === ownPath[i]) {
            i++;
        }
        return ownPath.substring(i).split("/").map(_ => "..").join("/") + "/" + path.substring(i);
    }
    /**
     *
     * @returns The path from the root to this element
     */
    getPath() {
        let currentPath = "/" + this.key;
        let currentElem = this;
        while (currentElem.parent != null) {
            currentElem = currentElem.parent;
            currentPath = "/" + currentElem.key + currentPath;
        }
        return currentPath;
    }
    remove() {
        this.removed = true;
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
     * @returns Boolean which indicates if changes to this object were made
     */
    merge(other) {
        // Only this timestamp
        if (this.lastModified != null && other.lastModified == null) {
            return false;
        }
        // Only other timestamp
        if (this.lastModified == null && other.lastModified != null) {
            this.setValue(other._value, false);
            this._reference = other._reference;
            this.lastModified = other.lastModified;
            return true;
        }
        // Timestamps equal
        if ((this.lastModified == null && other.lastModified == null) || this.lastModified.getTime() === other.lastModified.getTime()) {
            let changesMade = false;
            if (this.getType() == TSDType.collection && other.getType() == TSDType.collection) {
                other._value.forEach(element => {
                    if (!this.getKeys().includes(element.key)) {
                        this.addElement(element, false);
                    }
                    else {
                        changesMade = changesMade || (this.query(`./${element.key}`)?.merge(element) || false);
                    }
                });
            }
            return changesMade;
        }
        // This timestamp greater
        if (this.lastModified.getTime() > other.lastModified.getTime()) {
            return false;
        }
        // Other timestamp greater
        if (this.lastModified.getTime() < other.lastModified.getTime()) {
            this.setValue(other._value, false);
            this._reference = other._reference;
            this.lastModified = other.lastModified;
            return true;
        }
        return false;
    }
    toString(compact = false) {
        let keyStr = this.key;
        let valueStr = "null";
        switch (this._value?.constructor) {
            case "".constructor:
                valueStr = `"${this._value}"`;
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
