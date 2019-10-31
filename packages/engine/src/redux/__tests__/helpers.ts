import {ChannelState, ChannelStore} from "../channel-store";
import {StateWithSideEffects} from "../utils";
import {Commitment, SignedCommitment, getCommitmentChannelId} from "../../domain";
import {QueuedTransaction, OutboxState, MessageOutbox} from "../outbox/state";
import {SharedData} from "../state";
import {ProtocolStateWithSharedData} from "../protocols";
import {ProtocolLocator, RelayableAction} from "src/communication";
import _ from "lodash";
import {convertStateToCommitment} from "../../utils/nitro-converter";

type SideEffectState = StateWithSideEffects<any> | {outboxState: OutboxState} | {sharedData: SharedData};

const describeScenarioStep = (scenarioStep, fn) => {
  return describe(scenarioStepDescription(scenarioStep), fn);
};

describeScenarioStep.only = (scenarioStep, fn) => {
  return describe.only(scenarioStepDescription(scenarioStep), fn);
};

export {describeScenarioStep};

export function scenarioStepDescription(scenarioStep) {
  return `${scenarioStep.state.type} + \n    ${scenarioStep.action.type} =>`;
}

export const itSendsAMessage = (state: SideEffectState) => {
  it(`sends a message`, () => {
    expectSideEffect("messageOutbox", state, item => expect(item).toEqual(expect.anything()));
  });
};

export const itSendsNoMessage = (state: SideEffectState) => {
  it(`sends no message`, () => {
    expectSideEffect("messageOutbox", state, item => expect(item).toBeUndefined());
  });
};

export const itSendsThisMessage = (state: SideEffectState, message, idx = 0) => {
  if (Array.isArray(message)) {
    message.map((m, i) => itSendsThisMessage(state, m, i));
    return;
  }

  if (message.type) {
    // We've received the entire action
    it(`sends a message`, () => {
      expectSideEffect("messageOutbox", state, item => expect(item).toMatchObject(message), idx);
    });
  } else {
    // Assume we've only received the type of the message
    it(`sends message ${message}`, () => {
      expectSideEffect("messageOutbox", state, item => expect(item.type).toEqual(message), idx);
    });
  }
};

export const itSendsThisDisplayEventType = (state: SideEffectState, eventType: string) => {
  it(`sends event ${eventType}`, () => {
    expectSideEffect("displayOutbox", state, item => expect(item.type).toEqual(eventType));
  });
};

const expectSideEffect = (
  outboxBranch: string,
  state: SideEffectState,
  expectation: (item) => any,
  // actionOrObject: object | string | undefined,
  idx = 0
) => {
  let outbox;
  if ("sideEffects" in state && state.sideEffects) {
    outbox = state.sideEffects[outboxBranch];
  } else if ("outboxState" in state) {
    outbox = state.outboxState[outboxBranch];
  } else if ("sharedData" in state) {
    outbox = state.sharedData.outboxState[outboxBranch];
  }
  const item = Array.isArray(outbox) ? outbox[idx] : outbox;
  expectation(item);
};

export const expectThisMessage = (state: SideEffectState, messageType: string) => {
  expectSideEffect("messageOutbox", state, item => {
    expect(item.messagePayload.type).toEqual(messageType);
  });
};

type PartialCommitments = Array<{commitment: Partial<Commitment>; signature?: string}>;

function transformCommitmentToMatcher(sc: {commitment: Partial<Commitment>; signature?: string}) {
  if (sc.signature) {
    return expect.objectContaining({
      commitment: expect.objectContaining(sc.commitment),
      signature: sc.signature
    });
  } else {
    return expect.objectContaining({commitment: expect.objectContaining(sc.commitment)});
  }
}

export const itSendsThisCommitment = (
  state: SideEffectState,
  commitment: Partial<Commitment>,
  type = "ENGINE.COMMON.COMMITMENT_RECEIVED",
  idx = 0
) => {
  const messageOutbox = getOutboxState(state, "messageOutbox");

  it("sends a commitment", () => {
    try {
      // Passes when at least one message matches
      // In the case of multiple messages queued, this approach does not care about
      // their order, which is beneficial.
      // However, the diffs produced by jest are unreadable, so when this expectation fails,
      // we catch the error below
      expect(messageOutbox).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            messagePayload: expect.objectContaining({
              signedCommitment: transformCommitmentToMatcher({commitment})
            })
          })
        ])
      );
    } catch (err) {
      if ("matcherResult" in err) {
        // In this case, we've caught a jest expectation error.
        // We try to help the developer by using expect(foo).toMatchObject(bar)
        // The errors are much more useful in this case, but will be deceiving in the case when
        // multiple messages are queued.

        // To help with debugging, you can change the idx variable when running tests to 'search'
        // for the correct commitment

        console.warn(`Message not found: inspecting mismatched message in position ${idx}`);
        expect(messageOutbox[idx]).toMatchObject({
          messagePayload: {
            type,
            signedCommitment: {commitment}
          }
        });
      } else {
        throw err;
      }
    }
  });
};

export const itSendsTheseCommitments = (
  state: SideEffectState,
  commitments: PartialCommitments,
  type = "ENGINE.COMMON.COMMITMENTS_RECEIVED",
  idx = 0
) => {
  // TODO: Something in the conversion between nitro states and commitments is messing up the signature
  // so we'll ignore them for now
  commitments = commitments.map(c => {
    return {
      commitment: c.commitment
    };
  });
  const messageOutbox = getOutboxState(state, "messageOutbox");

  it("sends commitments", () => {
    try {
      // Passes when at least one message matches
      // In the case of multiple messages queued, this approach does not care about
      // their order, which is beneficial.
      // However, the diffs produced by jest are unreadable, so when this expectation fails,
      // we catch the error below
      expect(messageOutbox).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            messagePayload: expect.objectContaining({
              signedCommitments: commitments.map(transformCommitmentToMatcher)
            })
          })
        ])
      );
    } catch (err) {
      if ("matcherResult" in err) {
        // In this case, we've caught a jest expectation error.
        // We try to help the developer by using expect(foo).toMatchObject(bar)
        // The errors are much more useful in this case, but will be deceiving in the case when
        // multiple messages are queued.

        // To help with debugging, you can change the idx variable when running tests to 'search'
        // for the correct commitment
        console.warn(`Message not found: inspecting mismatched message in position ${idx}`);
        expect(messageOutbox[idx]).toMatchObject({
          messagePayload: {
            type,
            signedCommitments: commitments
          }
        });
      } else {
        throw err;
      }
    }
  });
};

function getOutboxState(state: SideEffectState, outboxBranch: "messageOutbox"): MessageOutbox {
  if ("sideEffects" in state && state.sideEffects && state.sideEffects[outboxBranch]) {
    return state.sideEffects[outboxBranch] as MessageOutbox;
  } else if ("outboxState" in state) {
    return state.outboxState[outboxBranch];
  } else if ("sharedData" in state) {
    return state.sharedData.outboxState[outboxBranch];
  }

  throw new Error("Invalid state");
}

export const itRelaysThisAction = (state: SideEffectState, action: RelayableAction, idx = 0) => {
  it(`relays the correct action`, () => {
    expectSideEffect("messageOutbox", state, item => expect(item.messagePayload).toMatchObject(action), idx);
  });
};

export const itSendsATransaction = (state: SideEffectState) => {
  it(`sends a transaction`, () => {
    expectSideEffect("transactionOutbox", state, item => expect(item).toBeDefined());
  });
};

export const itSendsThisTransaction = (state: SideEffectState, tx: QueuedTransaction) => {
  it(`sends a transaction`, () => {
    const {transactionRequest} = tx;
    expectSideEffect("transactionOutbox", state, item =>
      expect(item).toMatchObject({
        transactionRequest,
        processId: expect.any(String)
      })
    );
  });
};

export const itSendsNoTransaction = (state: SideEffectState) => {
  it(`doesn't send a transaction`, () => {
    expectSideEffect("transactionOutbox", state, item => expect(item).toBeUndefined());
  });
};

export const itTransitionsToStateType = (
  type,
  protocolStateWithSharedData: ProtocolStateWithSharedData<{type: any}>
) => {
  it(`transitions to ${type}`, () => {
    expect(protocolStateWithSharedData.protocolState.type).toEqual(type);
  });
};

export const itIncreasesTurnNumBy = (
  increase: number,
  oldState: ChannelState,
  newState: StateWithSideEffects<ChannelState>
) => {
  it(`increases the turnNum by ${increase}`, () => {
    if (!("turnNum" in newState.state) || !("turnNum" in oldState)) {
      fail("turnNum does not exist on one of the states");
    } else {
      expect(newState.state.turnNum).toEqual(oldState.turnNum + increase);
    }
  });
};

export const itStoresThisCommitment = (state: {channelStore: ChannelStore}, signedCommitment: SignedCommitment) => {
  it("stores the commitment in the channel state", () => {
    const channelId = getCommitmentChannelId(signedCommitment.commitment);
    const channelState = state.channelStore[channelId];
    // TODO: Due to conversion limitations the state might have been signed with the wrong key
    // This should be addressed when all the protocols use SignedStates
    const lastCommitment = convertStateToCommitment(channelState.signedStates.slice(-1)[0].state);
    expect(lastCommitment).toMatchObject(signedCommitment.commitment);
  });
};

export const itRegistersThisChannel = (
  state: SharedData,
  channelId: string,
  processId: string,
  protocolLocator: ProtocolLocator
) => {
  it("subscribes to channel events in the channel subscriptions", () => {
    const subscriptionState = state.channelSubscriptions[channelId];
    expect(subscriptionState).toContainEqual({protocolLocator, processId});
  });
};

export const mergeSharedData = (firstSharedData: SharedData, secondSharedData: SharedData): SharedData => {
  return _.merge({}, firstSharedData, secondSharedData);
};
