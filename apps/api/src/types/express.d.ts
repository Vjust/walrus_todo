import express from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      wallet?: string;
    }
  }
}

export {};