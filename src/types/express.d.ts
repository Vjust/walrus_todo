/**
 * Express module declarations
 * This file provides basic type definitions for the Express framework.
 */

declare module 'express' {
  export interface Request {
    body: any;
    params: Record<string, string>;
    query: Record<string, string>;
    headers: Record<string, string>;
    path: string;
    url: string;
    method: string;
    originalUrl: string;
    [key: string]: any;
  }

  export interface Response {
    status(code: number): Response;
    send(body?: any): Response;
    json(body?: any): Response;
    end(): Response;
    setHeader(name: string, value: string | string[]): Response;
    [key: string]: any;
  }

  export interface NextFunction {
    (err?: any): void;
    [key: string]: any;
  }

  export interface IRouter {
    get(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => any>): this;
    post(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => any>): this;
    put(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => any>): this;
    delete(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => any>): this;
    use(...handlers: Array<(req: Request, res: Response, next: NextFunction) => any>): this;
    use(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => any>): this;
    route(path: string): IRouter;
    [key: string]: any;
  }

  export function Router(options?: any): IRouter;
  
  export interface Application extends IRouter {
    set(name: string, value: any): this;
    listen(port: number, callback?: () => void): any;
    [key: string]: any;
  }

  export default function express(): Application;
}