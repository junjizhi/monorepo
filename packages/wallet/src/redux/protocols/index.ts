import {SharedData} from "../state";

import {ProtocolLocator, EmbeddedProtocol} from "../../communication";

import {WalletAction} from "../actions";

import {ChallengerState} from "./dispute/challenger/states";

import {DirectFundingState} from "./direct-funding/states";
import {FundingState} from "./funding/states";
import {NewLedgerChannelState} from "./new-ledger-channel/states";
import {ResponderState} from "./dispute/responder/states";
import {WithdrawalState} from "./withdrawing/states";
import {ApplicationState} from "./application/states";
import {LedgerDefundingState} from "./ledger-defunding/states";
import {DefundingState} from "./defunding/states";
import {ConcludingState} from "./concluding/states";
import {TransactionSubmissionState} from "./transaction-submission";
import {ExistingLedgerFundingState} from "./existing-ledger-funding/states";
import {LedgerTopUpState} from "./ledger-top-up/states";
import {ConsensusUpdateState} from "./consensus-update/states";
import {AdvanceChannelState} from "./advance-channel";
import {VirtualFundingState} from "./virtual-funding/states";
import {LedgerFundingState} from "./ledger-funding/states";

import {FundingStrategyNegotiationState} from "./funding-strategy-negotiation/states";
import {VirtualDefundingState} from "./virtual-defunding/states";
import {CloseLedgerChannelState} from "./close-ledger-channel/states";

export type ProtocolState =
  | ApplicationState
  | NewLedgerChannelState
  | VirtualFundingState
  | DirectFundingState
  | WithdrawalState
  | ResponderState
  | FundingState
  | DefundingState
  | ChallengerState
  | ConcludingState
  | LedgerDefundingState
  | TransactionSubmissionState
  | ExistingLedgerFundingState
  | LedgerTopUpState
  | ConsensusUpdateState
  | TransactionSubmissionState
  | AdvanceChannelState
  | LedgerFundingState
  | FundingStrategyNegotiationState
  | VirtualDefundingState
  | CloseLedgerChannelState;

export type ProtocolReducer<T extends ProtocolState> = (
  protocolState: T,
  sharedData: SharedData,
  action
) => ProtocolStateWithSharedData<T>;

export interface ProtocolStateWithSharedData<T extends ProtocolState> {
  protocolState: T;
  sharedData: SharedData;
}

export function makeLocator(...args: Array<ProtocolLocator | EmbeddedProtocol>): ProtocolLocator {
  return ([] as ProtocolLocator).concat(...args).filter(s => s.length > 0);
}
export const EMPTY_LOCATOR: ProtocolLocator = makeLocator();

export function prependToLocator<
  State extends {protocolLocator: ProtocolLocator},
  T extends (WalletAction | State) & {protocolLocator: ProtocolLocator}
>(actionOrState: T, protocol: ProtocolLocator | EmbeddedProtocol): T {
  // First we update any sub-protocol protocolLocators
  for (const prop of Object.keys(actionOrState)) {
    if (typeof actionOrState[prop] === "object" && "protocolLocator" in actionOrState[prop]) {
      actionOrState[prop] = prependToLocator(actionOrState[prop], protocol);
    }
  }
  return {
    ...actionOrState,
    protocolLocator: makeLocator(protocol, actionOrState.protocolLocator)
  };
}
