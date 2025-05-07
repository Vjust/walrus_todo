import { type TransactionType } from '@mysten/sui.js/transactions';

export class TransactionBlock {
  blockData: Map<string, any>;

  static PayAllSui = { kind: 'PayAllSui' };
  static Gas = { kind: 'GasObject' };

  constructor() {
    this.blockData = new Map();
  }

  moveCall(params: { target: string; arguments: any[] }) {
    return { type: 'move-call', ...params };
  }

  transferObjects(objects: any[], recipient: any) {
    return { type: 'transfer-objects', objects, recipient };
  }

  splitCoins(coin: any, amounts: any[]) {
    return { type: 'split-coins', coin, amounts };
  }

  mergeCoins(destination: any, sources: any[]) {
    return { type: 'merge-coins', destination, sources };
  }

  pure(value: any) {
    return { type: 'pure', value };
  }

  add(type: string, value: any) {
    this.blockData.set(type, value);
    return { type };
  }

  setGasBudget(budget: number) {
    this.blockData.set('gasBudget', budget);
  }

  setSender(sender: string) {
    this.blockData.set('sender', sender);
  }

  object(value: string) {
    return { type: 'object', value };
  }

  serialize(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array());
  }

  async build({ client }: { client: any }): Promise<{ bytes: Uint8Array }> {
    return new Uint8Array();
  }
}

export const Transaction = TransactionBlock;