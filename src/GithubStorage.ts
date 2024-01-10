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

    _data: TSDElement | null = null;
    isSyncing = false;
    status: GithubStorageStatus;

    onStatusChange: Function;
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

        hash(githubApi.token + githubApi.user + githubApi.repo + githubApi.branch + path, HashAlgorithm["SHA-1"]).then(v => {
            this.id = v
        });
    }


    public get data(): TSDElement | null {
        return this._data
    }

    public set data(v: TSDElement | null) {
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
        if (this.status = newStatus) return;

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
                } else {
                    this.data = loadedData;
                }

                let localData = this.getLocalData();
                if (localData != null) {
                    this.data.merge(localData);
                }

                // Upload data
                this.githubApi.updateFile(`${this.path}/data.tsd`, this.data.toString(), contentInfo.sha).catch(error => {
                    this.onError("Upload Failed:", error); // TODO: Error Handling
                })

                this.setStatus(GithubStorageStatus.online);
                this.saveToLocalData();

                resolve(this.data);
            }).catch(error => {
                console.info("Unable to load github data, switching to cache", error);

                let localData = this.getLocalData();
                if (localData) {
                    this.setStatus(GithubStorageStatus.offline);
                    this.data = localData;
                    resolve(this.data)
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