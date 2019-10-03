import {getAdjudicatorContract} from "../../utils/contract-utils";
import {call, take, put, select} from "redux-saga/effects";
import {eventChannel} from "redux-saga";
import * as actions from "../actions";
import {getAdjudicatorWatcherSubscribersForChannel} from "../selectors";
import {ChannelSubscriber} from "../state";
import {ProtocolLocator} from "../../communication";
import {getChallengeRegisteredEvent} from "@statechannels/nitro-protocol";
import {bigNumberify} from "ethers/utils";
import {Contract} from "ethers";

enum AdjudicatorEventType {
  ChallengeRegistered,
  ChallengeCleared,
  Concluded
}

interface AdjudicatorEvent {
  eventArgs: any;
  channelId: string;
  eventType: AdjudicatorEventType;
}

export function* adjudicatorWatcher(provider) {
  const adjudicatorEventChannel = yield call(createAdjudicatorEventChannel, provider);
  while (true) {
    const event: AdjudicatorEvent = yield take(adjudicatorEventChannel);

    const channelSubscribers: ChannelSubscriber[] = yield select(
      getAdjudicatorWatcherSubscribersForChannel,
      event.channelId
    );

    yield dispatchEventAction(event);
    for (const subscriber of channelSubscribers) {
      yield dispatchProcessEventAction(event, subscriber.processId, subscriber.protocolLocator);
    }
  }
}

function* dispatchEventAction(event: AdjudicatorEvent) {
  const {channelId} = event;
  switch (event.eventType) {
    case AdjudicatorEventType.ChallengeRegistered:
      const challengeRegisteredEvent = getChallengeRegisteredEvent(event.eventArgs);
      // Solidity timestamps are in seconds while JS are ms, so we convert to a JS timestamp
      const finalizedAtInMs = bigNumberify(challengeRegisteredEvent.finalizesAt)
        .mul(1000)
        .toNumber();
      yield put(
        actions.challengeCreatedEvent({
          channelId,
          finalizedAt: finalizedAtInMs,
          challengeStates: challengeRegisteredEvent.challengeStates
        })
      );
      break;
    case AdjudicatorEventType.ChallengeCleared:
      const newTurnNumRecord = event.eventArgs[1].toNumber();
      yield put(
        actions.challengeClearedEvent({
          channelId,
          newTurnNumRecord
        })
      );
      break;
    case AdjudicatorEventType.Concluded:
      yield put(actions.concludedEvent({channelId}));
      break;
    default:
      throw new Error(`Event is not a known adjudicator event. Cannot dispatch event action: ${JSON.stringify(event)}`);
  }
}

function* dispatchProcessEventAction(event: AdjudicatorEvent, processId: string, protocolLocator: ProtocolLocator) {
  const {channelId} = event;
  switch (event.eventType) {
    case AdjudicatorEventType.ChallengeRegistered:
      const {finalizedAt} = event.eventArgs;
      yield put(
        actions.challengeExpirySetEvent({
          processId,
          protocolLocator,
          channelId,
          expiryTime: finalizedAt * 1000
        })
      );
      break;
    case AdjudicatorEventType.ChallengeCleared:
      const newTurnNumRecord = event.eventArgs[1].toNumber();
      yield put(
        actions.challengeClearedEvent({
          channelId,
          newTurnNumRecord
        })
      );
      break;
    case AdjudicatorEventType.Concluded:
      yield put(actions.concludedEvent({channelId}));
      break;
    default:
      throw new Error(
        `Event is not a known adjudicator event. Cannot dispatch process event action: ${JSON.stringify(event)}`
      );
  }
}

function* createAdjudicatorEventChannel(provider) {
  const adjudicator: Contract = yield call(getAdjudicatorContract, provider);

  return eventChannel(emitter => {
    const challengeRegisteredFilter = adjudicator.filters.ChallengeRegistered();
    const challengeClearedFilter = adjudicator.filters.ChallengeCleared();
    const gameConcludedFilter = adjudicator.filters.Concluded();
    //  bytes32 indexed channelId,
    // // everything needed to respond or checkpoint
    // uint256 turnNumRecord,
    // uint256 finalizesAt,
    // address challenger,
    // bool isFinal,
    // FixedPart fixedPart,
    // ForceMoveApp.VariablePart[] variableParts
    adjudicator.on(challengeRegisteredFilter, (...eventArgs) => {
      emitter({
        eventType: AdjudicatorEventType.ChallengeRegistered,
        channelId: eventArgs[0],
        eventArgs
      });
    });
    adjudicator.on(challengeClearedFilter, (...eventArgs) => {
      emitter({eventType: AdjudicatorEventType.ChallengeCleared, channelId: eventArgs[0], eventArgs});
    });
    adjudicator.on(gameConcludedFilter, channelId => {
      emitter({eventType: AdjudicatorEventType.Concluded, channelId});
    });

    return () => {
      // This function is called when the channel gets closed
      adjudicator.removeAllListeners(challengeRegisteredFilter);
      adjudicator.removeAllListeners(challengeClearedFilter);
      adjudicator.removeAllListeners(gameConcludedFilter);
    };
  });
}
