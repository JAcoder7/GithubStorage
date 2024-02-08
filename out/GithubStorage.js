import { TSDParser } from "./TSD/TSDParser.js";
export var GithubStorageStatus;
(function (GithubStorageStatus) {
    GithubStorageStatus[GithubStorageStatus["notLoaded"] = 0] = "notLoaded";
    GithubStorageStatus[GithubStorageStatus["online"] = 1] = "online";
    GithubStorageStatus[GithubStorageStatus["offline"] = 2] = "offline";
    GithubStorageStatus[GithubStorageStatus["noData"] = 3] = "noData";
})(GithubStorageStatus || (GithubStorageStatus = {}));
export class GithubStorage {
    id = "";
    githubApi;
    path;
    /** NEVER set this directly. ONLY USE .data */
    _data = null;
    isSyncing = false;
    status;
    hasLocalOnlyChanges = false;
    onStatusChange;
    onSynced = () => { };
    onUploadFailed = () => { };
    onError;
    autoSync;
    syncQueued = false;
    constructor(githubApi, path, autoSync = true, onStatusChange = () => { }, onError = console.error) {
        this.githubApi = githubApi;
        this.path = path;
        this.autoSync = autoSync;
        this.status = GithubStorageStatus.notLoaded;
        this.onStatusChange = onStatusChange;
        this.onError = onError;
        this.initializeId();
    }
    async initializeId() {
        this.data = null;
        this.id = hashCode(this.githubApi.token + this.githubApi.user + this.githubApi.repo + this.githubApi.branch + this.path).toString(16);
    }
    get data() {
        return this._data;
    }
    set data(v) {
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
    setStatus(newStatus) {
        this.onStatusChange(this.status, newStatus);
        this.status = newStatus;
    }
    async sync(overrideData = false) {
        if (!this.isSaveToWrite())
            return Promise.reject("Github API configuration has changed. Reinitialisation required.");
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
            if (!this.isSaveToWrite())
                return Promise.reject("Github API configuration has changed. Reinitialisation required.");
            this.githubApi.getContentInfo(`${this.path}/data.tsd`).then(contentInfo => {
                if (!this.isSaveToWrite())
                    return Promise.reject("Github API configuration has changed. Reinitialisation required.");
                // Load data
                let content = this.githubApi.b64DecodeUnicode(contentInfo.content);
                let loadedData = TSDParser.parse(content);
                if (this.data != null && !overrideData) {
                    this.data.merge(loadedData);
                }
                else {
                    this.data = loadedData;
                }
                let localData = this.getLocalData();
                if (localData != null) {
                    this.data.merge(localData);
                }
                let hadLocalOnlyChanges = this.hasLocalOnlyChanges;
                this.hasLocalOnlyChanges = false;
                // Upload data
                if (!this.isSaveToWrite())
                    return Promise.reject("Github API configuration has changed. Reinitialisation required.");
                this.githubApi.updateFile(`${this.path}/data.tsd`, this.data.toString(), contentInfo.sha).catch(error => {
                    this.onUploadFailed(error);
                    this.syncQueued = true;
                    this.hasLocalOnlyChanges = this.hasLocalOnlyChanges || hadLocalOnlyChanges;
                });
                this.setStatus(GithubStorageStatus.online);
                if (!this.isSaveToWrite())
                    return Promise.reject("Github API configuration has changed. Reinitialisation required.");
                this.saveToLocalData();
                this.onSynced(this.data);
                resolve(this.data);
            }).catch(error => {
                if (!this.isSaveToWrite())
                    return Promise.reject("Github API configuration has changed. Reinitialisation required.");
                console.info("Unable to load github data, switching to cache", error);
                let localData = this.getLocalData();
                if (localData && this.isSaveToWrite()) {
                    this.setStatus(GithubStorageStatus.offline);
                    this.data = localData;
                    this.onSynced(this.data);
                    resolve(this.data);
                }
                else {
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
            });
        });
    }
    isSaveToWrite() {
        return (this.id == hashCode(this.githubApi.token + this.githubApi.user + this.githubApi.repo + this.githubApi.branch + this.path).toString(16));
    }
    getLocalData() {
        let stored = localStorage.getItem(`ghs_data_${this.id}`);
        if (stored == null) {
            return null;
        }
        else {
            return TSDParser.parse(stored);
        }
    }
    saveToLocalData() {
        if (this.data) {
            localStorage.setItem(`ghs_data_${this.id}`, this.data.toString(true));
        }
        else {
            throw new Error("Cant save data to localstorage: data is null");
        }
    }
}
var HashAlgorithm;
(function (HashAlgorithm) {
    HashAlgorithm[HashAlgorithm["SHA-1"] = 0] = "SHA-1";
    HashAlgorithm[HashAlgorithm["SHA-256"] = 1] = "SHA-256";
    HashAlgorithm[HashAlgorithm["SHA-384"] = 2] = "SHA-384";
    HashAlgorithm[HashAlgorithm["SHA-512"] = 3] = "SHA-512";
})(HashAlgorithm || (HashAlgorithm = {}));
async function hash(string, algorithm = HashAlgorithm["SHA-256"]) {
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
