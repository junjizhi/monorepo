import {PureComponent} from "react";

import React from "react";

import {connect} from "react-redux";

import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

import {faSpinner} from "@fortawesome/free-solid-svg-icons";

import * as fundingStates from "./funding/states";
import * as ApplicationStates from "./application/states";
import * as concludingStates from "./concluding/states";
import {Funding} from "./funding/container";
import {Concluding} from "./concluding/container";

import {isDefundingState} from "./defunding/states";
import {Defunding} from "./defunding";
import {Application} from "./application/container";

import {ProtocolState} from ".";

interface Props {
  protocolState: ProtocolState;
}

class ProtocolContainer extends PureComponent<Props> {
  render() {
    // TODO: A switch/unreachable would be better here
    // if we can figure out a way to do it.
    // Maybe every state has a protocol type on it?
    const {protocolState} = this.props;
    if (
      fundingStates.isFundingState(protocolState) &&
      fundingStates.isOngoingFundingState(protocolState)
    ) {
      return <Funding state={protocolState} />;
    } else if (ApplicationStates.isApplicationState(protocolState)) {
      return <Application state={protocolState} />;
    } else if (concludingStates.isNonTerminalConcludingState(protocolState)) {
      return <Concluding state={protocolState} />;
    } else if (isDefundingState(protocolState)) {
      return <Defunding state={protocolState} />;
    } else {
      return (
        <div>
          <FontAwesomeIcon icon={faSpinner} pulse={true} size="lg" />
        </div>
      );
    }
  }
}
export const Protocol = connect(() => ({}))(ProtocolContainer);
