export declare class CLIError extends Error {
    code: string;
    constructor(message: string, code?: string);
}
export declare function handleError(error: any): void;
