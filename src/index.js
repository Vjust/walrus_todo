#!/usr/bin/env node
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.run = void 0;
var core_1 = require("@oclif/core");
var Commands = require("./commands");
var WalTodo = /** @class */ (function (_super) {
    __extends(WalTodo, _super);
    function WalTodo() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    WalTodo.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var flags, commandNames, _i, commandNames_1, name_1, error_1, commandNames, _a, commandNames_2, name_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.parse(WalTodo)];
                    case 1:
                        flags = (_b.sent()).flags;
                        // Enable verbose logging if requested
                        if (flags.verbose) {
                            process.env.DEBUG = '*';
                        }
                        // Print help information
                        console.log(WalTodo.description);
                        if (flags.help) {
                            // Show more detailed help
                            console.log('\nCommands:');
                            commandNames = Object.keys(Commands).sort();
                            for (_i = 0, commandNames_1 = commandNames; _i < commandNames_1.length; _i++) {
                                name_1 = commandNames_1[_i];
                                console.log("  ".concat(name_1.padEnd(12), " ").concat(name_1, " command"));
                            }
                            console.log('\nFlags:');
                            console.log('  -v, --verbose  Show verbose output');
                            console.log('  -h, --help     Show help information');
                        }
                        console.log('\nUsage:');
                        console.log(WalTodo.examples.join('\n'));
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        // Handle parsing errors gracefully
                        console.log(WalTodo.description);
                        console.log('\nUsage:');
                        console.log(WalTodo.examples.join('\n'));
                        if (process.argv.includes('--help') || process.argv.includes('-h')) {
                            // Show help if --help flag is present
                            console.log('\nCommands:');
                            commandNames = Object.keys(Commands).sort();
                            for (_a = 0, commandNames_2 = commandNames; _a < commandNames_2.length; _a++) {
                                name_2 = commandNames_2[_a];
                                console.log("  ".concat(name_2.padEnd(12), " ").concat(name_2, " command"));
                            }
                            console.log('\nFlags:');
                            console.log('  -v, --verbose  Show verbose output');
                            console.log('  -h, --help     Show help information');
                        }
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WalTodo.description = 'A CLI for managing todos with Sui blockchain and Walrus storage';
    WalTodo.examples = [
        '$ waltodo add -t "Buy groceries"',
        '$ waltodo list',
        '$ waltodo complete 123'
    ];
    WalTodo.flags = {
        verbose: core_1.Flags.boolean({
            char: 'v',
            description: 'Show verbose output',
            default: false,
        }),
        help: core_1.Flags.boolean({
            char: 'h',
            description: 'Show help information',
            default: false,
        }),
    };
    WalTodo.commandIds = Object.values(Commands)
        .map(function (command) { return typeof command === 'function' && command.prototype instanceof core_1.Command ? command : null; })
        .filter(Boolean);
    return WalTodo;
}(core_1.Command));
exports.default = WalTodo;
// Ensure stdout and stderr are properly flushed
process.stdout.on('error', function (err) {
    if (err.code === 'EPIPE') {
        process.exit(0);
    }
});
// Main entry point for the CLI
var run = function () { return __awaiter(void 0, void 0, void 0, function () {
    var args, commandName_1, cmdIndex, cmd, CommandClass, error_2;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                args = process.argv.slice(2);
                if (!(args.length === 0)) return [3 /*break*/, 2];
                return [4 /*yield*/, WalTodo.run([])];
            case 1:
                _b.sent();
                return [2 /*return*/];
            case 2:
                commandName_1 = args[0];
                if (!(commandName_1 === '--help' || commandName_1 === '-h')) return [3 /*break*/, 4];
                return [4 /*yield*/, WalTodo.run(['--help'])];
            case 3:
                _b.sent();
                return [2 /*return*/];
            case 4:
                if (!(args.length > 1 && args.includes('-h'))) return [3 /*break*/, 6];
                cmdIndex = args.findIndex(function (arg) { return !arg.startsWith('-'); });
                if (!(cmdIndex !== -1)) return [3 /*break*/, 6];
                cmd = args[cmdIndex];
                return [4 /*yield*/, WalTodo.run([cmd, '--help'])];
            case 5:
                _b.sent();
                return [2 /*return*/];
            case 6:
                CommandClass = (_a = Object.entries(Commands).find(function (_a) {
                    var name = _a[0], _ = _a[1];
                    return name.toLowerCase().replace('command', '') === commandName_1.toLowerCase();
                })) === null || _a === void 0 ? void 0 : _a[1];
                if (!CommandClass) {
                    console.log("Command not found: ".concat(commandName_1));
                    console.log('Available commands:');
                    Object.keys(Commands).forEach(function (name) {
                        console.log("  ".concat(name.replace('Command', '')));
                    });
                    process.exit(1);
                }
                // Run the command with the remaining arguments
                return [4 /*yield*/, CommandClass.run(args.slice(1))];
            case 7:
                // Run the command with the remaining arguments
                _b.sent();
                return [3 /*break*/, 9];
            case 8:
                error_2 = _b.sent();
                console.error('Error running command:', error_2);
                process.exit(1);
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.run = run;
// Run the CLI if this file is executed directly
if (require.main === module) {
    (0, exports.run)().catch(function (error) {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}
