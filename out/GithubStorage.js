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
    _data = null;
    isSyncing = false;
    status;
    onStatusChange;
    onSynced = () => { };
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
        hash(githubApi.token + githubApi.user + githubApi.repo + githubApi.branch + path, HashAlgorithm["SHA-1"]).then(v => {
            this.id = v;
        });
    }
    get data() {
        return this._data;
    }
    set data(v) {
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
        if (this.status = newStatus)
            return;
        this.onStatusChange(this.status, newStatus);
        this.status = newStatus;
    }
    async sync(overrideData = false) {
        if (this.data != null) {
            let localData = this.getLocalData();
            if (localData != null) {
                this.data.merge(localData);
            }
            this.saveToLocalData();
        }
        if (this.isSyncing) {
            console.log(this);
            this.syncQueued = true;
            return Promise.reject("Githubstorage is already loading");
        }
        this.isSyncing = true;
        return new Promise((resolve, reject) => {
            this.githubApi.getContentInfo(`${this.path}/data.tsd`).then(contentInfo => {
                // Load data
                let content = this.githubApi.b64DecodeUnicode(contentInfo.content);
                let loadedData = TSDParser.parse(content);
                console.log(loadedData);
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
                // Upload data
                this.githubApi.updateFile(`${this.path}/data.tsd`, this.data.toString(), contentInfo.sha).catch(error => {
                    this.onError("Upload Failed:", error); // TODO: Error Handling
                });
                this.setStatus(GithubStorageStatus.online);
                this.saveToLocalData();
                this.onSynced(this.data);
                resolve(this.data);
            }).catch(error => {
                console.info("Unable to load github data, switching to cache", error);
                let localData = this.getLocalData();
                if (localData) {
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
