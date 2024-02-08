import { GithubAPI } from "./GithubAPI.js";
import { TSDElement } from "./TSD/TSDElement.js";
import { TSDParser } from "./TSD/TSDParser.js";

export enum GithubStorageStatus {
    notLoaded,
    online,
    offline,
    noData
}

export class GithubStorage {
    id: string = "";

    githubApi: GithubAPI;
    path: string;

    /** NEVER set this directly. ONLY USE .data */
    _data: TSDElement | null = null;
    isSyncing = false;
    status: GithubStorageStatus;
    hasLocalOnlyChanges = false;

    onStatusChange: Function;
    onSynced: Function = () => { };
    onUploadFailed: Function = () => { };
    onError: Function;

    autoSync: boolean;

    syncQueued = false;

    constructor(githubApi: GithubAPI, path, autoSync = true, onStatusChange: Function = () => { }, onError: Function = console.error) {
        this.githubApi = githubApi;
        this.path = path;
        this.autoSync = autoSync;
        this.status = GithubStorageStatus.notLoaded;
        this.onStatusChange = onStatusChange;
        this.onError = onError;

        this.initializeId()
    }

    async initializeId() {
        this.data = null;
        this.id = hashCode(this.githubApi.token + this.githubApi.user + this.githubApi.repo + this.githubApi.branch + this.path).toString(16);
    }


    public get data(): TSDElement | null {
        return this._data
    }

    public set data(v: TSDElement | null) {
        if (this._data) {
            this._data.onChange = () => { };
        }
        this._data = v;
        if (this._data) {
            this._data.onChange = () => {
                if (this.autoSync) {
                    this.sync();
                }
            };
        }
    }


    setStatus(newStatus: GithubStorageStatus) {
        this.onStatusChange(this.status, newStatus);
        this.status = newStatus;
    }

    async sync(overrideData = false) {
        if (!this.isSaveToWrite()) return Promise.reject("Github API configuration has changed. Reinitialisation required.")

        if (this.data != null) {
            let localData = this.getLocalData();
            if (localData != null) {
                this.data.merge(localData);
            }
            this.saveToLocalData();
        }
        if (this.isSyncing) {
            this.syncQueued = true;
            return Promise.reject("Githubstorage is already loading");
        }
        this.isSyncing = true;

        return new Promise((resolve, reject) => {
            if (!this.isSaveToWrite()) return Promise.reject("Github API configuration has changed. Reinitialisation required.")
            this.githubApi.getContentInfo(`${this.path}/data.tsd`).then(contentInfo => {
                if (!this.isSaveToWrite()) return Promise.reject("Github API configuration has changed. Reinitialisation required.")

                // Load data
                let content = this.githubApi.b64DecodeUnicode(contentInfo.content);

                let loadedData = TSDParser.parse(content);

                if (this.data != null && !overrideData) {
                    this.data.merge(loadedData);
                } else {
                    this.data = loadedData;
                }

                let localData = this.getLocalData();
                if (localData != null) {
                    this.data.merge(localData);
                }

                let hadLocalOnlyChanges = this.hasLocalOnlyChanges;
                this.hasLocalOnlyChanges = false

                // Upload data
                if (!this.isSaveToWrite()) return Promise.reject("Github API configuration has changed. Reinitialisation required.")
                this.githubApi.updateFile(`${this.path}/data.tsd`, this.data.toString(), contentInfo.sha).catch(error => {
                    this.onUploadFailed(error);
                    this.syncQueued = true;
                    this.hasLocalOnlyChanges = this.hasLocalOnlyChanges || hadLocalOnlyChanges;
                })

                this.setStatus(GithubStorageStatus.online);
                if (!this.isSaveToWrite()) return Promise.reject("Github API configuration has changed. Reinitialisation required.")
                this.saveToLocalData();

                this.onSynced(this.data);
                resolve(this.data);
            }).catch(error => {
                if (!this.isSaveToWrite()) return Promise.reject("Github API configuration has changed. Reinitialisation required.")
                console.info("Unable to load github data, switching to cache", error);

                let localData = this.getLocalData();
                if (localData && this.isSaveToWrite()) {
                    this.setStatus(GithubStorageStatus.offline);
                    this.data = localData;

                    this.onSynced(this.data);
                    resolve(this.data);
                } else {
                    if (this.data == null) {
                        this.setStatus(GithubStorageStatus.noData);
                    }
                    reject("no data in cache");
                }
            }).finally(() => {
                this.isSyncing = false;
                if (this.syncQueued) {
                    this.syncQueued = false;
                    this.sync();
                }
            })
        })
    }

    private isSaveToWrite() {
        return (this.id == hashCode(this.githubApi.token + this.githubApi.user + this.githubApi.repo + this.githubApi.branch + this.path).toString(16))
    }

    private getLocalData() {
        let stored = localStorage.getItem(`ghs_data_${this.id}`);
        if (stored == null) {
            return null;
        } else {
            return TSDParser.parse(stored);
        }
    }

    saveToLocalData() {
        if (this.data) {
            localStorage.setItem(`ghs_data_${this.id}`, this.data.toString(true));
        } else {
            throw new Error("Cant save data to localstorage: data is null");
        }
    }
}

enum HashAlgorithm {
    "SHA-1",
    "SHA-256",
    "SHA-384",
    "SHA-512"
}
async function hash(string: string, algorithm: HashAlgorithm = HashAlgorithm["SHA-256"]) {
    const utf8 = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest(HashAlgorithm[algorithm], utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map((bytes) => bytes.toString(16).padStart(2, '0'))
        .join('');
    return hashHex;
}

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