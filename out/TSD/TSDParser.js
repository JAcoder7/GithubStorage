import { TSDElement } from "./TSDElement.js";
export const TSDParser = {
    TOKENS: {
        KEY: /^(?<val>[\w-]+)\s*(?<removed>\[rem\]|\[removed\])?\s*:/,
        BRACKET_OPEN: /^{/,
        BRACKET_CLOSE: /^}/,
        COMMA: /^,/,
        STRING: /^"(?<val>[^"]*)"/,
        NUMBER: /^(?<val>\d+(\.\d*)?)/,
        NULL: /^null/,
        TIMESTAMP: /^\|\s*(?<val>\d+)/,
        REFERENCE: /^(?<val>(\.){0,2}(\/(\w+|\.\.))+)/,
    },
    parse: function (str) {
        let tokens = [];
        while (str.length != 0) {
            let { remainder, token } = this.parseToken(str);
            str = remainder;
            tokens.push(token);
        }
        return this.parseElement(tokens);
    },
    parseElement: function (tokens) {
        let key = tokens.splice(0, 1)[0];
        if (key.type != "KEY")
            throw new SyntaxError("Unexpected Token: " + key.type + ".  Expected: KEY");
        let value = null;
        let reference = null;
        let valToken = tokens.splice(0, 1)[0];
        switch (valToken.type) {
            case "BRACKET_OPEN":
                let elements = [];
                while (tokens[0].type != "BRACKET_CLOSE") {
                    elements.push(this.parseElement(tokens));
                    if (tokens[0].type == "COMMA") {
                        tokens.splice(0, 1);
                    }
                }
                value = elements;
                if (tokens.splice(0, 1)[0].type != "BRACKET_CLOSE") {
                    throw new SyntaxError("Unexpected Token: " + key.type + ".  Expected: BRACKET_CLOSE");
                }
                break;
            case "STRING":
                value = valToken.groups.val;
                break;
            case "NUMBER":
                value = Number(valToken.groups.val);
                break;
            case "NULL":
                value = null;
                break;
            case "REFERENCE":
                reference = valToken.groups.val;
                break;
            default:
                throw new SyntaxError("Unexpected Token: " + valToken.type);
        }
        let lastModified = null;
        if (tokens[0]?.type == "TIMESTAMP") {
            lastModified = new Date(Number(tokens.splice(0, 1)[0].groups.val));
        }
        let newElement = new TSDElement(key.groups.val, value, key.groups.removed != undefined, lastModified);
        if (reference) {
            newElement.setReference(reference);
            newElement.lastModified = lastModified;
        }
        return newElement;
    },
    parseToken: function (text) {
        text = text.trim();
        let token = null;
        for (const key of Object.keys(this.TOKENS)) {
            const result = this.TOKENS[key].exec(text);
            if (result) {
                token = { type: key, groups: result.groups };
                text = text.replace(this.TOKENS[key], "");
                break;
            }
        }
        if (!token) {
            throw new Error("Parse Error: Unknown token (" + text + ")");
        }
        return { remainder: text, token: token };
    }
};
