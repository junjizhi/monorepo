import {
  SignedStatesReceived,
  BaseProcessAction,
  isCommonAction,
  ProtocolLocator,
  EmbeddedProtocol
} from "../../../communication";
import {WalletAction} from "../../actions";
import {ActionConstructor} from "../../utils";
import {routerFactory} from "../../../communication/actions";

export interface ClearedToSend extends BaseProcessAction {
  type: "WALLET.ADVANCE_CHANNEL.CLEARED_TO_SEND";
  protocolLocator: ProtocolLocator;
}

export type AdvanceChannelAction = SignedStatesReceived | ClearedToSend;

export const clearedToSend: ActionConstructor<ClearedToSend> = p => {
  const {processId, protocolLocator} = p;
  return {
    type: "WALLET.ADVANCE_CHANNEL.CLEARED_TO_SEND",
    processId,
    protocolLocator
  };
};

export function isAdvanceChannelAction(action: WalletAction): action is AdvanceChannelAction {
  return (
    isCommonAction(action, EmbeddedProtocol.AdvanceChannel) ||
    action.type === "WALLET.ADVANCE_CHANNEL.CLEARED_TO_SEND"
  );
}

export const routesToAdvanceChannel = routerFactory(
  isAdvanceChannelAction,
  EmbeddedProtocol.AdvanceChannel
);
