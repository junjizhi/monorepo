import {encodeConsensusData} from '@statechannels/nitro-protocol';
import {Model} from 'objection';
import {
  allocationOutcome2,
  allocationOutcome3,
  DUMMY_ASSET_HOLDER_ADDRESS,
  DUMMY_RULES_ADDRESS,
  guaranteeOutcome2,
  holdings2,
  holdings3
} from '../../../test/test-constants';
import {
  BEGINNING_APP_CHANNEL_ID,
  beginningAppPhaseChannel,
  channelObjectToModel,
  consensusAppData2,
  consensusAppData3,
  FUNDED_CHANNEL_ID,
  FUNDED_CHANNEL_ID_3,
  FUNDED_GUARANTOR_CHANNEL_ID,
  fundedChannel,
  fundedChannel3,
  fundedGuarantorChannel,
  ONGOING_APP_CHANNEL_ID,
  ongoingAppPhaseChannel,
  UNFUNDED_CHANNEL_ID,
  unfundedChannel
} from '../../../test/test-data';
import Channel from '../../models/channel';
import {outcomeObjectToModel} from '../../utilities/outcome';
import knex from '../../../db-admin/db-admin-connection';

Model.knex(knex);

const baseStateProperties = {
  appDefinition: DUMMY_RULES_ADDRESS,
  isFinal: false,
  challengeDuration: 1000
};

// ***************
// Ledger channels
// ***************

function prefundSetupState(turnNum: number) {
  return {
    ...baseStateProperties,
    turnNum,
    outcome: outcomeObjectToModel(allocationOutcome2),
    appData: encodeConsensusData(consensusAppData2(2))
  };
}

function prefundSetupGuarantorState(turnNum: number) {
  return {
    ...baseStateProperties,
    turnNum,
    outcome: outcomeObjectToModel(guaranteeOutcome2),
    // Todo: appData does not reflect the outcome above
    appData: encodeConsensusData(consensusAppData2(2))
  };
}

function prefundSetupState3(turnNum: number) {
  return {
    ...baseStateProperties,
    turnNum,
    outcome: outcomeObjectToModel(allocationOutcome3),
    appData: encodeConsensusData(consensusAppData3(3))
  };
}

function postfundSetupState(turnNum: number) {
  return {
    ...baseStateProperties,
    turnNum,
    outcome: outcomeObjectToModel(allocationOutcome2),
    appData: encodeConsensusData(consensusAppData2(0))
  };
}

function appState(turnNum: number) {
  return {
    ...baseStateProperties,
    turnNum,
    outcome: outcomeObjectToModel(allocationOutcome2),
    appData: encodeConsensusData(consensusAppData2(turnNum % 2))
  };
}

const unfundedChannelWithStates = {
  ...channelObjectToModel(unfundedChannel),
  channelId: UNFUNDED_CHANNEL_ID,
  states: [prefundSetupState(0), prefundSetupState(1)]
};

const fundedChannelWithStates = {
  ...channelObjectToModel(fundedChannel),
  channelId: FUNDED_CHANNEL_ID,
  states: [prefundSetupState(0), prefundSetupState(1)],
  holdings: [{assetHolderAddress: DUMMY_ASSET_HOLDER_ADDRESS, amount: holdings2}]
};

const fundedGuarantorChannelWithStates = {
  ...channelObjectToModel(fundedGuarantorChannel),
  channelId: FUNDED_GUARANTOR_CHANNEL_ID,
  states: [prefundSetupGuarantorState(0), prefundSetupGuarantorState(1)],
  holdings: [{assetHolderAddress: DUMMY_ASSET_HOLDER_ADDRESS, amount: holdings2}]
};

const fundedChannel3WithStates = {
  ...channelObjectToModel(fundedChannel3),
  channelId: FUNDED_CHANNEL_ID_3,
  states: [prefundSetupState3(0), prefundSetupState3(1), prefundSetupState3(2)],
  holdings: [{assetHolderAddress: DUMMY_ASSET_HOLDER_ADDRESS, amount: holdings3}]
};

const beginningAppPhaseChannelWithStates = {
  ...channelObjectToModel(beginningAppPhaseChannel),
  channel_id: BEGINNING_APP_CHANNEL_ID,
  states: [postfundSetupState(2), postfundSetupState(3)],
  holdings: [{assetHolderAddress: DUMMY_ASSET_HOLDER_ADDRESS, amount: holdings2}]
};

const ongoingAppPhaseChannelWithStates = {
  ...channelObjectToModel(ongoingAppPhaseChannel),
  channel_id: ONGOING_APP_CHANNEL_ID,
  states: [appState(4), appState(5)],
  holdings: [{assetHolderAddress: DUMMY_ASSET_HOLDER_ADDRESS, amount: holdings2}]
};

const twoParticipantChannelSeeds = {
  unfundedChannelWithStates,
  fundedChannelWithStates,
  fundedGuarantorChannelWithStates,
  beginningAppPhaseChannelWithStates,
  ongoingAppPhaseChannelWithStates
};

const threeParticipantChannelSeeds = {fundedChannel3WithStates};

const SEEDED_CHANNELS_2 = Object.keys(twoParticipantChannelSeeds).length;
const SEEDED_CHANNELS_3 = Object.keys(threeParticipantChannelSeeds).length;

const SEEDED_STATES_2 = SEEDED_CHANNELS_2 * 2;
const SEEDED_STATES_3 = SEEDED_CHANNELS_3 * 3;

const SEEDED_ALLOCATIONS_2 = SEEDED_STATES_2 * 2;
const SEEDED_ALLOCATIONS_3 = SEEDED_STATES_3 * 3;

const SEEDED_PARTICIPANTS_2 = SEEDED_CHANNELS_2 * 2;
const SEEDED_PARTICIPANTS_3 = SEEDED_CHANNELS_3 * 3;

// *******
// Exports
// *******
export const SEEDED_CHANNELS = SEEDED_CHANNELS_2 + SEEDED_CHANNELS_3;
export const SEEDED_STATES = SEEDED_STATES_2 + SEEDED_STATES_3;
export const SEEDED_ALLOCATIONS = SEEDED_ALLOCATIONS_2 + SEEDED_ALLOCATIONS_3;
export const SEEDED_PARTICIPANTS = SEEDED_PARTICIPANTS_2 + SEEDED_PARTICIPANTS_3;

export const seeds = {
  ...twoParticipantChannelSeeds,
  ...threeParticipantChannelSeeds
};

export function seed() {
  return knex('channels')
    .del()
    .then(() => Channel.query().insertGraph(Object.values(seeds)));
}

export const stateConstructors = {
  postfundSetupState
};
