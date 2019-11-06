import {bigNumberify} from "ethers/utils";

import {ConsensusData, encodeConsensusData} from "@statechannels/nitro-protocol/lib/src/contract/consensus-data";
import {Outcome, State, Channel, getChannelId, Signatures, SignedState} from "@statechannels/nitro-protocol";
import {NETWORK_ID, ETH_ASSET_HOLDER_ADDRESS, CONSENSUS_LIBRARY_ADDRESS} from "../../constants";
import {convertAddressToBytes32} from "../../utils/data-type-utils";
import {TwoPartyPlayerIndex, ThreePartyPlayerIndex} from "../types";
import {unreachable} from "../../utils/reducer-utils";

export const asPrivateKey = "0xf2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d";
export const asAddress = "0x5409ED021D9299bf6814279A6A1411A7e866A631";
export const bsPrivateKey = "0x5d862464fe9303452126c8bc94274b8c5f9874cbd219789b3eb2128075a76f72";
export const bsAddress = "0x6Ecbe1DB9EF729CBe972C83Fb886247691Fb6beb";
export const hubPrivateKey = "0xce442e75dd539bd632aca84efa0b7de5c5b48aa4bbf028c8a6c17b2e7a16446e";
export const hubAddress = "0xAbcdE1140bA6aE8e702b78f63A4eA1D1553144a1";

export const threeParticipants: [string, string, string] = [asAddress, bsAddress, hubAddress];
export const participants: [string, string] = [asAddress, bsAddress];

export const libraryAddress = "0x" + "1".repeat(40);
export const channelNonce = "0x04";
export const channel = {channelType: libraryAddress, nonce: Number.parseInt(channelNonce, 16), participants};

export const nitroChannel: Channel = {channelNonce, participants, chainId: bigNumberify(NETWORK_ID).toHexString()};
// Use Nitro protocol channel id so we're always using the same channel Id
export const channelId = getChannelId(nitroChannel);

export function convertBalanceToOutcome(balances): Outcome {
  return [
    {
      assetHolderAddress: ETH_ASSET_HOLDER_ADDRESS,
      allocation: balances.map(b => {
        const destination = b.address.length === 66 ? b.address : convertAddressToBytes32(b.address);
        return {destination, amount: b.wei};
      })
    }
  ];
}

interface Balance {
  address: string;
  wei: string;
}

export const twoThree = [
  {address: asAddress, wei: bigNumberify(2).toHexString()},
  {address: bsAddress, wei: bigNumberify(3).toHexString()}
];
const twoThreeTwo = [
  {address: asAddress, wei: bigNumberify(2).toHexString()},
  {address: bsAddress, wei: bigNumberify(3).toHexString()},
  {address: hubAddress, wei: bigNumberify(2).toHexString()}
];

export const addressAndPrivateKeyLookup: {
  [idx in TwoPartyPlayerIndex | ThreePartyPlayerIndex]: {address: string; privateKey: string};
} = {
  [TwoPartyPlayerIndex.A]: {address: asAddress, privateKey: asPrivateKey},
  [TwoPartyPlayerIndex.B]: {address: bsAddress, privateKey: bsPrivateKey},
  [ThreePartyPlayerIndex.A]: {address: asAddress, privateKey: asPrivateKey},
  [ThreePartyPlayerIndex.B]: {address: bsAddress, privateKey: bsPrivateKey},
  [ThreePartyPlayerIndex.Hub]: {address: hubAddress, privateKey: hubPrivateKey}
};

interface AppCommitmentParams {
  turnNum: number;
  isFinal?: boolean;
  balances?: Balance[];
  appAttributes?: string;
}

export function appState(params: AppCommitmentParams): SignedState {
  const turnNum = params.turnNum;
  const balances = params.balances || twoThree;
  const isFinal = params.isFinal || false;
  const appData = params.appAttributes || "0x00";
  const outcome = [
    {
      assetHolderAddress: ETH_ASSET_HOLDER_ADDRESS,
      allocation: balances.map(b => {
        return {destination: convertAddressToBytes32(b.address), amount: b.wei};
      })
    }
  ];
  const state: State = {
    channel: nitroChannel,
    isFinal,
    appData,
    turnNum,
    outcome,
    challengeDuration: 300,
    appDefinition: libraryAddress
  };
  const privateKey = turnNum % 2 === 0 ? asPrivateKey : bsPrivateKey;

  return Signatures.signState(state, privateKey);
}
interface LedgerCommitmentParams {
  turnNum: number;
  isFinal?: boolean;
  balances?: Balance[];
  proposedBalances?: Balance[];
}

interface ThreeWayLedgerCommitmentParams extends LedgerCommitmentParams {
  isVote?: boolean;
  commitmentCount?: number;
}

const LEDGER_CHANNEL_NONCE = 0;
export const ledgerChannel = {
  nonce: LEDGER_CHANNEL_NONCE,
  channelType: CONSENSUS_LIBRARY_ADDRESS,
  participants
};

export const ledgerNitroChannel: Channel = {
  chainId: bigNumberify(NETWORK_ID).toHexString(),
  channelNonce: "0x00",
  participants
};
// Use Nitro protocol channel id so we're always using the same channel Id
export const ledgerId = getChannelId(ledgerNitroChannel);

export const threeWayLedgerNitroChannel = {
  chainId: bigNumberify(NETWORK_ID).toHexString(),
  channelNonce: "0x00",
  participants: threeParticipants
};

export const threeWayLedgerId = getChannelId(threeWayLedgerNitroChannel);

export const threeWayLedgerChannel = {
  nonce: LEDGER_CHANNEL_NONCE,
  channelType: CONSENSUS_LIBRARY_ADDRESS,
  participants: threeParticipants
};

export function threeWayLedgerState(params: ThreeWayLedgerCommitmentParams): SignedState {
  const turnNum = params.turnNum;
  const isFinal = params.isFinal || false;
  const balances = params.balances || twoThreeTwo;

  let furtherVotesRequired = 0;
  if (params.proposedBalances) {
    furtherVotesRequired = params.isVote ? 1 : 2;
  }

  const outcome = convertBalanceToOutcome(balances);
  const proposedOutcome = !!params.proposedBalances ? convertBalanceToOutcome(params.proposedBalances) : [];
  const consensusData: ConsensusData = {furtherVotesRequired, proposedOutcome};
  const appData = encodeConsensusData(consensusData);

  const state: State = {
    channel: threeWayLedgerNitroChannel,
    isFinal,
    appData,
    turnNum,
    outcome,
    challengeDuration: 300,
    appDefinition: CONSENSUS_LIBRARY_ADDRESS
  };

  const idx: ThreePartyPlayerIndex = turnNum % 3;
  switch (idx) {
    case ThreePartyPlayerIndex.A:
      return Signatures.signState(state, asPrivateKey);
    case ThreePartyPlayerIndex.B:
      return Signatures.signState(state, bsPrivateKey);
    case ThreePartyPlayerIndex.Hub:
      return Signatures.signState(state, hubPrivateKey);
    default:
      return unreachable(idx);
  }
}

export function ledgerState(params: LedgerCommitmentParams): SignedState {
  const turnNum = params.turnNum;
  const isFinal = params.isFinal || false;
  const balances = params.balances || twoThree;

  let furtherVotesRequired = 0;
  if (params.proposedBalances) {
    furtherVotesRequired = 1;
  }
  const outcome = convertBalanceToOutcome(balances);
  const proposedOutcome = !!params.proposedBalances ? convertBalanceToOutcome(params.proposedBalances) : [];
  const consensusData: ConsensusData = {furtherVotesRequired, proposedOutcome};

  const appData = encodeConsensusData(consensusData);

  const state: State = {
    channel: ledgerNitroChannel,
    isFinal,
    appData,
    turnNum,
    outcome,
    challengeDuration: 300,
    appDefinition: CONSENSUS_LIBRARY_ADDRESS
  };

  const privateKey = turnNum % 2 === 0 ? asPrivateKey : bsPrivateKey;

  return Signatures.signState(state, privateKey);
}