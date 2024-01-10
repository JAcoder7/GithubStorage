export class GithubAPI {
    token: string;
    user: string;
    repo: string;
    branch: string;
    defaultCommitter: { "name": string, "email": string };

    constructor(token: string, user: string, repo: string, branch: string = "main", defaultCommitter: { "name": string, "email": string } = { "name": "githubApi", email: "null" }) {
        this.token = token;
        this.user = user;
        this.repo = repo;
        this.branch = branch;
        this.defaultCommitter = defaultCommitter;
    }

    async getData(url: string) {
        let baseUrl = "https://api.github.com";
        const headers = {
            "Authorization": `token ${this.token}`,
            "Accept": "application/vnd.github+json"
        }

        return new Promise<any>((resolve, reject) => {
            fetch(baseUrl + url, {
                "cache": "no-store",
                "method": "GET",
                "headers": headers,
            }).then((response) => {
                if (response.ok) {
                    resolve(response.json())
                } else {
                    reject(response);
                }
            }).catch((error) => {
                reject(error)
            });
        });
    }

    async getUser() { return this.getData(`/user`); }
    async getRepo() { return this.getData(`/repos/${this.user}/${this.repo}`); }
    async getBranch() { return this.getData(`/repos/${this.user}/${this.repo}/branches/${this.branch}`); }

    async getContentInfo(path: string) { return this.getData(`/repos/${this.user}/${this.repo}/contents/${path}?ref=${this.branch}`); }

    async getContent(path: string) {
        let url = `https://api.github.com/repos/${this.user}/${this.repo}/contents/${path}?ref=${this.branch}`;
        const headers = {
            "Authorization": `token ${this.token}`,
            "Accept": "application/vnd.github.raw"
        }

        return new Promise<any>((resolve, reject) => {
            fetch(url, {
                "cache": "no-store",
                "method": "GET",
                "headers": headers,
            }).then((response) => {
                if (response.ok) {
                    resolve(response.text())
                } else {
                    reject(response);
                }
            }).catch((error) => {
                reject(error)
            });
        });
    }

    async createFile(path: string, content: string, commitMessage: string = ("create " + path), committer: { "name": string, "email": string } = this.defaultCommitter) {
        const headers = {
            "Authorization": `Token ${this.token}`,
        }

        const url = `https://api.github.com/repos/${this.user}/${this.repo}/contents/${path}?ref=${this.branch}`;

        const response = await fetch(url, {
            "method": "PUT",
            "headers": headers,
            "body": JSON.stringify({
                "message": commitMessage,
                "content": this.b64EncodeUnicode(content),
                "committer": committer
            })
        })
        if (response.status == 200) {
            const result = await response.json()
            return result;
        }
        //this.logError(GithubStorageLogLevel.normal, response);

        return null;
    }

    async updateFile(path: string, content: string, sha: string | undefined = undefined, commitMessage: string = ("update " + path), committer: { "name": string, "email": string } = this.defaultCommitter) {
        const headers = {
            "Authorization": `Token ${this.token}`,
        }
        if (sha == undefined) {
            let contentInfo = await this.getContentInfo(path).catch(e => { });
            sha = contentInfo?.sha;
        }

        const url = `https://api.github.com/repos/${this.user}/${this.repo}/contents/${path}`;

        return new Promise((resolve, reject) => {
            fetch(url, {
                "cache": "no-store",
                "method": "PUT",
                "headers": headers,
                "body": JSON.stringify({
                    "message": commitMessage,
                    "content": this.b64EncodeUnicode(content),
                    "sha": sha,
                    "committer": committer,
                    "branch": this.branch
                })
            }).then((response) => {
                if (response.ok) {
                    resolve(response)
                } else {
                    reject(response);
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    async deleteFile(path: string, commitMessage: string = ("delete " + path), committer: { "name": string, "email": string } = this.defaultCommitter) {
        const headers = {
            "Authorization": `Token ${this.token}`,
        }
        let sha = (await this.getContentInfo(path)).sha;

        const url = `https://api.github.com/repos/${this.user}/${this.repo}/contents/${path}`;

        const response = await fetch(url, {
            "method": "DELETE",
            "headers": headers,
            "body": JSON.stringify({
                "message": commitMessage,
                "sha": sha,
                "committer": committer,
                "branch": this.branch
            })
        })

        const result = await response.json()
        return result;
    }

    // Encoding UTF-8 ⇢ base64

    b64EncodeUnicode(str: string) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode(parseInt(p1, 16))
        }))
    }

    // Decoding base64 ⇢ UTF-8

    b64DecodeUnicode(str: string) {
        return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
    }

    
    // Encoding UTF-8 ⇢ base64

    static b64EncodeUnicode(str: string) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode(parseInt(p1, 16))
        }))
    }

    // Decoding base64 ⇢ UTF-8

    static b64DecodeUnicode(str: string) {
        return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
    }
}


