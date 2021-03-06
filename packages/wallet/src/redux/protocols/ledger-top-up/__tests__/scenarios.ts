import {bigNumberify} from "ethers/utils";

import {SignedState} from "@statechannels/nitro-protocol";

import * as states from "../states";
import {preSuccessA, preSuccessB} from "../../direct-funding/__tests__";
import {
  channelId,
  ledgerId,
  asAddress,
  bsAddress,
  addressAndPrivateKeyLookup,
  convertBalanceToOutcome,
  ledgerState
} from "../../../__tests__/state-helpers";
import {TwoPartyPlayerIndex} from "../../../types";
import {twoPlayerPreSuccessA, twoPlayerPreSuccessB} from "../../consensus-update/__tests__";
import {setChannels} from "../../../state";
import {channelFromStates} from "../../../channel-store/channel-state/__tests__";
import {makeLocator} from "../..";
import {EmbeddedProtocol} from "../../../../communication";

const protocolLocator = makeLocator(EmbeddedProtocol.LedgerTopUp);
// ---------
// Test data
// ---------

const fourFive = [
  {address: asAddress, wei: bigNumberify(4).toHexString()},
  {address: bsAddress, wei: bigNumberify(5).toHexString()}
];

const twoThree = [
  {address: asAddress, wei: bigNumberify(2).toHexString()},
  {address: bsAddress, wei: bigNumberify(3).toHexString()}
];
const threeFourFlipped = [
  {address: bsAddress, wei: bigNumberify(3).toHexString()},
  {address: asAddress, wei: bigNumberify(4).toHexString()}
];
const fourTwo = [
  {address: asAddress, wei: bigNumberify(4).toHexString()},
  {address: bsAddress, wei: bigNumberify(2).toHexString()}
];

const processId = "process-id.123";
const defaultProps = {
  processId,
  channelId,
  ledgerId,
  proposedOutcome: convertBalanceToOutcome(fourFive),
  originalOutcome: convertBalanceToOutcome(twoThree),
  protocolLocator
};

const oneOverFundedOneUnderFundedProps = {
  processId,
  channelId,
  ledgerId,
  proposedOutcome: convertBalanceToOutcome(fourTwo),
  originalOutcome: convertBalanceToOutcome(twoThree),
  protocolLocator
};

const ledgerTwoThree = ledgerState({turnNum: 5, balances: twoThree});
const ledgerThreeFourFlipped = ledgerState({turnNum: 5, balances: threeFourFlipped});

// ------
// States
// ------
const consensusStates = {
  [TwoPartyPlayerIndex.A]: twoPlayerPreSuccessA.state,
  [TwoPartyPlayerIndex.B]: twoPlayerPreSuccessB.state
};
const switchOrderAndAddATopUpUpdate = (props, ourIndex: TwoPartyPlayerIndex) =>
  states.switchOrderAndAddATopUpUpdate({
    ...props,
    consensusUpdateState: consensusStates[ourIndex]
  });
const waitForDirectFundingForA = (props, ourIndex: TwoPartyPlayerIndex) =>
  states.waitForDirectFundingForA({
    ...props,
    directFundingState: preSuccessA.state,
    consensusUpdateState: consensusStates[ourIndex]
  });
const restoreOrderAndAddBTopUpUpdate = (props, ourIndex: TwoPartyPlayerIndex) =>
  states.restoreOrderAndAddBTopUpUpdate({
    ...props,
    consensusUpdateState: consensusStates[ourIndex]
  });
const waitForDirectFundingForB = props =>
  states.waitForDirectFundingForB({
    ...props,
    directFundingState: preSuccessA.state
  });

// ------
// Actions
// ------

const playerAConsensusUpdateSuccess = twoPlayerPreSuccessA.action;
const playerBConsensusUpdateSuccess = twoPlayerPreSuccessB.action;
const playerAFundingSuccess = preSuccessA.action;
const playerBFundingSuccess = preSuccessB.action;

// ------
// Shared Data
// ------
const consensusSharedData = (ourIndex: TwoPartyPlayerIndex) => {
  return ourIndex === TwoPartyPlayerIndex.A
    ? twoPlayerPreSuccessA.sharedData
    : twoPlayerPreSuccessB.sharedData;
};
const fundingSharedData = (ourIndex: TwoPartyPlayerIndex, latestState: SignedState) => {
  return setChannels(
    ourIndex === TwoPartyPlayerIndex.A ? preSuccessA.sharedData : preSuccessB.sharedData,
    [
      channelFromStates(
        [latestState],
        addressAndPrivateKeyLookup[ourIndex].address,
        addressAndPrivateKeyLookup[ourIndex].privateKey
      )
    ]
  );
};

// ------
// Scenarios
// ------
export const playerAHappyPath = {
  initialize: {
    ...defaultProps,
    sharedData: fundingSharedData(TwoPartyPlayerIndex.A, ledgerTwoThree)
  },

  switchOrderAndAddATopUpUpdate: {
    state: switchOrderAndAddATopUpUpdate(defaultProps, TwoPartyPlayerIndex.A),
    sharedData: consensusSharedData(TwoPartyPlayerIndex.A),
    action: playerAConsensusUpdateSuccess
  },
  waitForDirectFundingForA: {
    state: waitForDirectFundingForA(defaultProps, TwoPartyPlayerIndex.A),
    sharedData: fundingSharedData(TwoPartyPlayerIndex.A, ledgerThreeFourFlipped),
    action: playerAFundingSuccess
  },
  restoreOrderAndAddBTopUpUpdate: {
    state: restoreOrderAndAddBTopUpUpdate(defaultProps, TwoPartyPlayerIndex.A),
    sharedData: consensusSharedData(TwoPartyPlayerIndex.A),
    action: playerAConsensusUpdateSuccess
  },
  waitForDirectFundingForB: {
    state: waitForDirectFundingForB(defaultProps),
    sharedData: fundingSharedData(TwoPartyPlayerIndex.A, ledgerThreeFourFlipped),
    action: playerAFundingSuccess
  }
};

export const playerBHappyPath = {
  initialize: {
    ...defaultProps,
    sharedData: fundingSharedData(TwoPartyPlayerIndex.B, ledgerTwoThree)
  },
  switchOrderAndAddATopUpUpdate: {
    state: switchOrderAndAddATopUpUpdate(defaultProps, TwoPartyPlayerIndex.B),
    sharedData: consensusSharedData(TwoPartyPlayerIndex.B),
    action: playerBConsensusUpdateSuccess
  },
  waitForDirectFundingForA: {
    state: waitForDirectFundingForA(defaultProps, TwoPartyPlayerIndex.B),
    sharedData: fundingSharedData(TwoPartyPlayerIndex.B, ledgerThreeFourFlipped),
    action: playerBFundingSuccess
  },
  restoreOrderAndAddBTopUpUpdate: {
    state: restoreOrderAndAddBTopUpUpdate(defaultProps, TwoPartyPlayerIndex.B),
    sharedData: consensusSharedData(TwoPartyPlayerIndex.B),
    action: playerBConsensusUpdateSuccess
  },
  waitForDirectFundingForB: {
    state: waitForDirectFundingForB(defaultProps),
    sharedData: fundingSharedData(TwoPartyPlayerIndex.A, ledgerThreeFourFlipped),
    action: playerBFundingSuccess
  }
};

export const playerAOneUserNeedsTopUp = {
  initialize: {
    ...oneOverFundedOneUnderFundedProps,
    sharedData: fundingSharedData(TwoPartyPlayerIndex.A, ledgerTwoThree)
  },

  switchOrderAndAddATopUpUpdate: {
    state: switchOrderAndAddATopUpUpdate(oneOverFundedOneUnderFundedProps, TwoPartyPlayerIndex.B),
    sharedData: consensusSharedData(TwoPartyPlayerIndex.A),
    action: playerAConsensusUpdateSuccess
  },
  waitForDirectFundingForA: {
    state: waitForDirectFundingForA(oneOverFundedOneUnderFundedProps, TwoPartyPlayerIndex.B),
    sharedData: fundingSharedData(TwoPartyPlayerIndex.A, ledgerThreeFourFlipped),
    action: playerAFundingSuccess
  },
  restoreOrderAndAddBTopUpUpdate: {
    state: restoreOrderAndAddBTopUpUpdate(oneOverFundedOneUnderFundedProps, TwoPartyPlayerIndex.B),
    sharedData: consensusSharedData(TwoPartyPlayerIndex.A),
    action: playerAConsensusUpdateSuccess
  }
};

export const playerBOneUserNeedsTopUp = {
  initialize: {
    ...oneOverFundedOneUnderFundedProps,
    sharedData: fundingSharedData(TwoPartyPlayerIndex.B, ledgerTwoThree)
  },

  switchOrderAndAddATopUpUpdate: {
    state: switchOrderAndAddATopUpUpdate(oneOverFundedOneUnderFundedProps, TwoPartyPlayerIndex.B),
    sharedData: consensusSharedData(TwoPartyPlayerIndex.B),
    action: playerAConsensusUpdateSuccess
  },
  waitForDirectFundingForA: {
    state: waitForDirectFundingForA(oneOverFundedOneUnderFundedProps, TwoPartyPlayerIndex.B),
    sharedData: fundingSharedData(TwoPartyPlayerIndex.B, ledgerThreeFourFlipped),
    action: playerAFundingSuccess
  },
  restoreOrderAndAddBTopUpUpdate: {
    state: restoreOrderAndAddBTopUpUpdate(oneOverFundedOneUnderFundedProps, TwoPartyPlayerIndex.B),
    sharedData: consensusSharedData(TwoPartyPlayerIndex.B),
    action: playerAConsensusUpdateSuccess
  }
};
