import { Signature } from 'ethers/utils';
import { State } from '@statechannels/nitro-protocol';

import { add } from './mathOps';
import { SignedState } from './types';
export type ChainEventListener = (event: ChainEvent) => void;
export type ChainEventType = ChainEvent['type'];
export interface IChain {
  initialize(): Promise<void>;
  getHoldings: (channelId: string) => Promise<string>;
  deposit: (channelId: string, expectedHeld: string, amount: string) => Promise<void>;
  on: (chainEventType: ChainEventType, listener: ChainEventListener) => () => void;
  forceMove(support: SignedState[], challengerSig: Signature);
  checkpoint(support: SignedState[]);
}

export class Chain implements IChain {
  public async initialize(): Promise<void> {
    // Do nothing
  }
  protected _holdings: { [channelId: string]: string };

  constructor(holdings?) {
    this._holdings = holdings || {};
  }

  public async getHoldings(channelId) {
    return this._holdings[channelId] || '0';
  }

  public async deposit(channelId: string, expectedHeld: string, amount: string): Promise<void> {
    const current = this._holdings[channelId] || 0;
    if (current >= expectedHeld) {
      this._holdings[channelId] = add(this._holdings[channelId] || 0, amount);
      this.triggerEvent({
        type: 'DEPOSITED',
        channelId,
        amount,
        total: this._holdings[channelId],
      });
    } else {
      this.triggerEvent({ type: 'REVERT' });
    }
  }

  public triggerEvent(chainEvent: ChainEvent) {
    if (this._listeners) {
      this._listeners.map(listener => listener(chainEvent));
    }
  }
  private _listeners: ChainEventListener[] = [];

  public on(_, listener) {
    this._listeners.push(listener);
    const idx = this._listeners.length - 1;

    return () => this._listeners.splice(idx, 1);
  }

  public setHoldings(channelId, amount) {
    this._holdings[channelId] = amount;
  }

  public forceMove(support: SignedState[], _challengerSig: Signature) {
    const { state } = support[0];
    this.triggerEvent({
      type: 'CHALLENGE_REGISTERED',
      challengeState: state,
    });
  }

  public checkpoint(support: SignedState[]) {
    this.triggerEvent({
      type: 'CHALLENGE_CLEARED',
      newTurnNumRecord: Math.max(...support.map(s => s.state.turnNum)),
    });
  }
}

// The store would send this action whenever the channel is updated
export interface Deposited {
  type: 'DEPOSITED';
  channelId: string;
  amount: string;
  total: string;
}

export interface Revert {
  type: 'REVERT';
}

export interface ChallengeRegistered {
  type: 'CHALLENGE_REGISTERED';
  challengeState: State;
}

export interface ChallengeCleared {
  type: 'CHALLENGE_CLEARED';
  newTurnNumRecord: number;
}

export type ChainEvent = Deposited | Revert | ChallengeRegistered | ChallengeCleared;
