"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeystoreSigner = void 0;
var fs = require("fs");
var os = require("os");
var path = require("path");
var ed25519_1 = require("@mysten/sui.js/keypairs/ed25519");
var child_process_1 = require("child_process");
var cryptography_1 = require("@mysten/sui.js/cryptography");
var KeystoreSigner = /** @class */ (function () {
    function KeystoreSigner(suiClient) {
        this.suiClient = suiClient;
        this.keypair = {};
        // Get active address
        var activeAddressOutput = (0, child_process_1.execSync)('sui client active-address').toString().trim();
        var activeAddress = activeAddressOutput.trim();
        if (!activeAddress) {
            throw new Error('No active Sui address found');
        }
        // Read keystore file
        var homeDir = os.homedir();
        var keystorePath = path.join(homeDir, '.sui', 'sui_config', 'sui.keystore');
        var keystore;
        try {
            var keystoreData = fs.readFileSync(keystorePath, 'utf-8');
            keystore = JSON.parse(keystoreData); // Array of base64 strings
        }
        catch (error) {
            var errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error("Failed to read keystore file: ".concat(errorMessage));
        }
        // Find the key that matches the active address
        var secretKeyBuffer;
        for (var _i = 0, keystore_1 = keystore; _i < keystore_1.length; _i++) {
            var keyBase64 = keystore_1[_i];
            var keyBuffer = Buffer.from(keyBase64, 'base64');
            var skBuffer = keyBuffer.subarray(1); // Remove flag byte, should be 32 bytes
            try {
                var tmpKeypair = ed25519_1.Ed25519Keypair.fromSecretKey(skBuffer);
                var tmpAddress = tmpKeypair.getPublicKey().toSuiAddress();
                if (tmpAddress === activeAddress) {
                    this.keypair = tmpKeypair;
                    break;
                }
            }
            catch (e) {
                // Skip invalid keys
                continue;
            }
        }
        if (!this.keypair.getPublicKey) {
            throw new Error("No key found in keystore for address ".concat(activeAddress));
        }
    }
    KeystoreSigner.prototype.signTransaction = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var signature;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.signTransactionBlock(input)];
                    case 1:
                        signature = _a.sent();
                        return [2 /*return*/, {
                                bytes: input,
                                signature: signature.toString()
                            }];
                }
            });
        });
    };
    KeystoreSigner.prototype.signMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.signWithIntent(message, cryptography_1.IntentScope.PersonalMessage)];
            });
        });
    };
    KeystoreSigner.prototype.sign = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.keypair.sign(message)];
            });
        });
    };
    KeystoreSigner.prototype.signWithIntent = function (message, intent) {
        return this.keypair.signWithIntent(message, intent);
    };
    KeystoreSigner.prototype.getKeyScheme = function () {
        return this.keypair.getKeyScheme();
    };
    KeystoreSigner.prototype.getPublicKey = function () {
        return this.keypair.getPublicKey();
    };
    KeystoreSigner.prototype.toSuiAddress = function () {
        return this.keypair.getPublicKey().toSuiAddress();
    };
    KeystoreSigner.prototype.signTransactionBlock = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var signature;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.keypair.signTransactionBlock(input)];
                    case 1:
                        signature = _a.sent();
                        return [2 /*return*/, {
                                bytes: input,
                                signature: signature.toString()
                            }];
                }
            });
        });
    };
    KeystoreSigner.prototype.signPersonalMessage = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.keypair.signPersonalMessage(input)];
            });
        });
    };
    KeystoreSigner.prototype.signData = function (data) {
        return this.keypair.signData(data);
    };
    KeystoreSigner.prototype.export = function () {
        return this.keypair.export();
    };
    return KeystoreSigner;
}());
exports.KeystoreSigner = KeystoreSigner;
