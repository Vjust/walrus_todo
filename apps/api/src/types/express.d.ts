import { Request as ExpressRequest, Response as ExpressResponse, Application as ExpressApplication } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      wallet?: string;
      ip: string;
      method: string;
      url: string;
      path: string;
      headers: any;
      header(name: string): string | undefined;
      get(name: string): string | undefined;
      params: any;
      query: any;
      body: any;
    }
    
    interface Response {
      statusCode: number;
      json(body?: any): Response;
      status(code: number): Response;
      send(body?: any): Response;
      cookie(name: string, value: any, options?: any): Response;
      clearCookie(name: string, options?: any): Response;
      redirect(status: number, path: string): void;
      redirect(path: string): void;
      end(): void;
      set(field: string, value: string): Response;
      setHeader(field: string, value: string): Response;
      get(field: string): string | undefined;
      header(field: string, value: string): Response;
      type(type: string): Response;
      sendStatus(statusCode: number): Response;
      location(path: string): Response;
      vary(field: string): Response;
      locals: Record<string, any>;
    }
    
    interface Application {
      use(...args: any[]): Application;
      get(...args: any[]): Application;
      post(...args: any[]): Application;
      put(...args: any[]): Application;
      patch(...args: any[]): Application;
      delete(...args: any[]): Application;
      options(...args: any[]): Application;
      head(...args: any[]): Application;
      all(...args: any[]): Application;
      listen(port: number, callback?: () => void): any;
      listen(port: number, hostname: string, callback?: () => void): any;
      set(setting: string, value: any): Application;
      enabled(setting: string): boolean;
      disabled(setting: string): boolean;
      enable(setting: string): Application;
      disable(setting: string): Application;
      locals: Record<string, any>;
    }
  }
}

declare module 'express' {
  interface NextFunction {
    (): void;
    (error?: any): void;
  }
  
  interface RequestHandler {
    (req: Request, res: Response, next: NextFunction): void;
  }
  
  interface ErrorRequestHandler {
    (err: any, req: Request, res: Response, next: NextFunction): void;
  }
}

// Re-export the Express types to ensure they're available throughout the API
export interface Request extends ExpressRequest {
  user?: any;
  wallet?: string;
  ip: string;
  method: string;
  url: string;
  path: string;
  headers: any;
  header(name: string): string | undefined;
  get(name: string): string | undefined;
  params: any;
  query: any;
  body: any;
}

export interface Response extends ExpressResponse {
  statusCode: number;
  json(body?: any): Response;
  status(code: number): Response;
  send(body?: any): Response;
  cookie(name: string, value: any, options?: any): Response;
  clearCookie(name: string, options?: any): Response;
  redirect(status: number, path: string): void;
  redirect(path: string): void;
  end(): void;
  set(field: string, value: string): Response;
  setHeader(field: string, value: string): Response;
  get(field: string): string | undefined;
  header(field: string, value: string): Response;
  type(type: string): Response;
  sendStatus(statusCode: number): Response;
  location(path: string): Response;
  vary(field: string): Response;
  locals: Record<string, any>;
}

export interface NextFunction {
  (): void;
  (error?: any): void;
}

export interface RequestHandler {
  (req: Request, res: Response, next: NextFunction): void;
}

export interface ErrorRequestHandler {
  (err: any, req: Request, res: Response, next: NextFunction): void;
}

export {};