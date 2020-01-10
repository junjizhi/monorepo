import { CreateChannelEvent } from './protocols/wallet/protocol';
import { AddressableMessage } from './wire-protocol';
import { ethAllocationOutcome } from '.';
import { ethers } from 'ethers';

const one = '0x0000000000000000000000000000000000000000000000000000000000000001';
const two = '0x0000000000000000000000000000000000000000000000000000000000000001';
const first = new ethers.Wallet(one).address;
const second = new ethers.Wallet(two).address;

const signatures = [];

const messagesToSecond: AddressableMessage[] = [];
messagesToSecond.push({
  type: 'OPEN_CHANNEL',
  signedState: {
    state: {
      appData: '0x',
      appDefinition: '0x',
      isFinal: false,
      turnNum: 0,
      outcome: ethAllocationOutcome([
        { destination: first, amount: '3' },
        { destination: second, amount: '1' },
      ]),
      channel: {
        participants: [first, second],
        channelNonce: '1',
        chainId: '0x42',
      },
      challengeDuration: 1,
    },
    signatures: [],
  },
  to: second,
});
messagesToSecond.push({
  type: 'SendStates',
  signedStates: [
    {
      state: {
        appData: '0x',
        appDefinition: '0x',
        isFinal: false,
        turnNum: 1,
        outcome: ethAllocationOutcome([
          { destination: first, amount: '3' },
          { destination: second, amount: '1' },
        ]),
        channel: {
          participants: [first, second],
          channelNonce: '1',
          chainId: '0x42',
        },
        challengeDuration: 1,
      },
      signatures: [],
    },
  ],
  to: second,
});
messagesToSecond.push({
  to: second,
  type: 'FUNDING_STRATEGY_PROPOSED',
  targetChannelId: 'first+second',
  choice: 'Indirect',
});

const messagesToFirst: AddressableMessage[] = [];
messagesToFirst.push({
  type: 'SendStates',
  signedStates: [
    {
      state: {
        appData: '0x',
        appDefinition: '0x',
        isFinal: false,
        turnNum: 1,
        outcome: ethAllocationOutcome([
          {
            destination: first,
            amount: '3',
          },
          {
            destination: second,
            amount: '1',
          },
        ]),
        channel: {
          participants: [first, second],
          channelNonce: '1',
          chainId: '0x42',
        },
        challengeDuration: 1,
      },
      signatures: [],
    },
  ],
  to: first,
});
messagesToFirst.push({
  type: 'FUNDING_STRATEGY_PROPOSED',
  choice: 'Indirect',
  targetChannelId: 'first+second+1',
  to: first,
});

export const createChannel: CreateChannelEvent = {
  type: 'CREATE_CHANNEL',
  participants: [
    {
      participantId: first,
      signingAddress: first,
      destination: first,
    },
    {
      participantId: second,
      signingAddress: second,
      destination: second,
    },
  ],
  allocations: [
    { destination: first, amount: '3' },
    { destination: second, amount: '1' },
  ],
  appDefinition: '0x',
  appData: '0x',
};

export { messagesToSecond, messagesToFirst };
