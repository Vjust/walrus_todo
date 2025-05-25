
declare global {
  namespace Express {
    interface Request {
      apiKey?: string;
      userId?: string;
      body: any;
      params: any;
      query: any;
    }

    interface Response {
      json(body?: any): this;
      status(code: number): this;
      send(body?: any): this;
    }
  }
}

export {};
