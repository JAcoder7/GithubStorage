/**
 * Type of a TSD-Element
 * [collection, string, number, null, reference]
 */
export enum TSDType {
    collection,
    string,
    number,
    null,
    reference,
}
type TSDElementValueType = TSDElement[] | string | number | null;

export class TSDElement {

    private _key: string = "";
    private _value: TSDElementValueType = null;
    private _reference: string | null = null;
    public removed: boolean;

    public parent: TSDElement | null;
    public lastModified: Date | null;

    public onChange: Function | null = null;

    constructor(key: string, value: TSDElementValueType, removed = false, lastModified: Date | null = null, parent: TSDElement | null = null) {
        this.key = key;
        this.value = value;

        this.lastModified = lastModified;
        this.removed = removed;
        this.parent = parent;
    }

    public set key(v: string) {
        if (/^[\w-]+$/.test(v)) {
            this._key = v;
        } else {
            throw new Error("Invalid key");
        }
    }

    public get key(): string {
        return this._key
    }


    public set value(v: TSDElement | TSDElementValueType) {
        this.setValue(v);
    }

    public setValue(v: TSDElement | TSDElementValueType, doesTriggerChangeEvent = true) {
        if (v?.constructor == this.constructor) {
            if ((v as TSDElement).root != this.root) {
                throw new Error("Reference element does not share the same root");
            }

            this.lastModified = new Date();
            this.setReference(this.getRelativePath(v as TSDElement));
            if (doesTriggerChangeEvent) this.triggerChangeEvent();
            return;
        }

        if (v?.constructor == ([]).constructor) {
            this._value = [];
            (v as TSDElement[]).forEach(element => {
                if ((this._value as Array<TSDElement>).filter(e => e.key == element.key).length == 0) {
                    element.parent = this;
                    (this._value as Array<TSDElement>).push(element);
                }
            });

            this.lastModified = new Date();
            if (doesTriggerChangeEvent) this.triggerChangeEvent();

            return;
        }

        this._value = v as TSDElementValueType;
        this.lastModified = new Date();

        if (doesTriggerChangeEvent) this.triggerChangeEvent();
    }

    public get value(): TSDElementValueType {
        if (this._reference) {
            let ref = this.query(this._reference)?.value;
            if (!ref) console.error("Invalid reference:", this._reference);

            return ref || null;
        }
        return this._value;
    }

    public addElement(element: TSDElement, doesTriggerChangeEvent = true) {
        if (this.getType() == TSDType.collection) {
            if (!Object.keys(this._value as TSDElement[]).includes(element.key)) {
                element.parent = this;
                (this._value as TSDElement[]).push(element);
                if (doesTriggerChangeEvent) this.triggerChangeEvent();
            } else {
                throw new Error(`An element with the key '${element.key}' already exists in the collection`);
            }
        } else {
            throw new Error("Elements can only be added to collections");
        }
    }

    public setReference(path: string, doesTriggerChangeEvent = true) {
        this._value = null;
        this._reference = path;
        this.lastModified = new Date();
        if (doesTriggerChangeEvent) this.triggerChangeEvent();
    }

    public getKeys(): Array<string> {
        if (this.getType() == TSDType.collection) {
            return (this.value as Array<TSDElement>).map(e => e.key)
        } else {
            throw new Error("'getKeys()' is only available on a collection");
        }
    }

    /**
     * Returns the value of the first element in the collection of this elements value where predicate is true, and undefined otherwise.
     * @param predicate find calls predicate once for each element of the array, in ascending order, until it finds one where predicate returns true. If such an element is found, find immediately returns that element value. Otherwise, find returns undefined.
     * @returns 
     */
    public find(predicate: (value: TSDElement, index: number, obj: TSDElement[]) => boolean): TSDElement | undefined {
        if (this.getType() == TSDType.collection) {
            return (this.value as TSDElement[]).find(predicate);
        } else {
            throw new Error("'find()' is only available on a collection");
        }
    }

    /**
     * 
     * @returns The type of this elements value
     */
    public getType(): TSDType {
        if (this._reference) {
            return TSDType.reference;
        }
        switch (this._value?.constructor) {
            case "".constructor:
                return TSDType.string;
            case (0).constructor:
                return TSDType.number
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

    public getTypeTree() {
        if (this.getType() == TSDType.collection) {
            let typeArr: any[] = [];
            (this.value as TSDElement[]).forEach(element => {
                if (!typeArr.includes(element.getTypeTree())) {
                    typeArr.push(element.getTypeTree())
                }
            });
            return typeArr;
        } else {
            return TSDType[this.getType()];
        }
    }

    public get root(): TSDElement {
        return this.findRoot()
    }

    /**
     * 
     * @returns The root of this element
     */
    public findRoot(): TSDElement {
        let currentElem: TSDElement | null = this;
        while (currentElem.parent != null) {
            currentElem = currentElem.parent;
        }
        return currentElem;
    }

    public query(path: string): TSDElement | null {
        if (!/^(?<val>(\.){0,2}(\/(\w+|\.\.))+)$/.test(path)) {
            throw new SyntaxError("Invalid path:" + path);
        }
        let segments = path.split("/");
        if (segments[1] == "") {
            return this;
        }

        let searchOrigin: TSDElement;
        if (segments[0] == "") {
            searchOrigin = this.root;
        } else if (segments[0] == "..") {
            if (!this.parent) return null;
            searchOrigin = this.parent;
        } else {
            searchOrigin = this;
        }

        let result: TSDElement | null;

        if (segments[1] == "..") {
            result = searchOrigin.parent;
        } else {
            if (searchOrigin.getType() != TSDType.collection) {
                return null;
            }
            result = searchOrigin.find(v => v.key == segments[1]) || null;
        }

        if (segments.length > 2) {
            return result?.query("./" + segments.slice(2).join("/")) || null
        } else {
            return result
        }
    }

    /**
     * get the relative path from this element to an other element
     */
    public getRelativePath(other: TSDElement): string {
        let path = other.getPath();
        let ownPath = this.getPath();
        let i = 0;
        while (i < path.length && i < ownPath.length && path[i] === ownPath[i]) {
            i++;
        }
        return ownPath.substring(i).split("/").map(_ => "..").join("/") + "/" + path.substring(i)
    }

    /**
     * 
     * @returns The path from the root to this element
     */
    public getPath(): string {
        let currentPath = "/" + this.key;
        let currentElem: TSDElement | null = this;
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
    merge(other: TSDElement): boolean {
        // Only this timestamp
        if (this.lastModified != null && other.lastModified == null) {
            return false;
        }

        // Only other timestamp
        if (this.lastModified == null && other.lastModified != null) {
            this.setValue(other._value, false);
            this._reference = other._reference;
            this.lastModified = other.lastModified
            return true;
        }

        // Timestamps equal
        if ((this.lastModified == null && other.lastModified == null) || (this.lastModified as Date).getTime() === (other.lastModified as Date).getTime()) {
            let changesMade = false;
            if (this.getType() == TSDType.collection && other.getType() == TSDType.collection) {
                (other._value as Array<TSDElement>).forEach(element => {
                    if (!this.getKeys().includes(element.key)) {
                        this.addElement(element, false);
                    } else {
                        changesMade = changesMade || (this.query(`./${element.key}`)?.merge(element) || false);
                    }
                });
            }
            return changesMade;
        }
        // This timestamp greater
        if ((this.lastModified as Date).getTime() > (other.lastModified as Date).getTime()) {
            return false;
        }
        // Other timestamp greater
        if ((this.lastModified as Date).getTime() < (other.lastModified as Date).getTime()) {
            this.setValue(other._value, false);
            this._reference = other._reference;
            this.lastModified = other.lastModified
            return true;
        }
        return false;
    }

    toString(compact: boolean = false) {
        let keyStr = this.key;
        let valueStr = "null";
        switch (this._value?.constructor) {
            case "".constructor:
                valueStr = `"${this._value as string}"`;
                break;
            case [].constructor:
                if (compact) {
                    valueStr = `{${(this._value as TSDElement[]).map(e => e.toString(compact)).join(",")}}`;
                } else {
                    valueStr = `{\n${(this._value as TSDElement[]).map(e => `    ${e.toString(compact).split("\n").join("\n    ")}`).join(",\n")}\n}`;
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
        } else {
            let lastModifiedStr = this.lastModified == null ? "" : `| ${this.lastModified.getTime()}`;
            return `${keyStr}${param}: ${valueStr} ${lastModifiedStr}`;
        }
    }
}