import { GithubAPI } from "../out/GithubAPI.js";
import { GithubStorage, GithubStorageStatus } from "../out/GithubStorage.js";

let gh = new GithubAPI("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", "JAcoder7", "SyncProj", "JAcoder7");
let storage = new GithubStorage(gh, "ghApiTest", true, (oldS, newS) => { console.log("status Change:",GithubStorageStatus[oldS],"->", GithubStorageStatus[newS]) });
storage.sync();
window.storage = storage