import {JsonRpcRequest} from '@statechannels/channel-provider';
import Enzyme, {mount, ReactWrapper} from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import {History} from 'history';
import React from 'react';
import {RouteComponentProps, Router} from 'react-router';
import {BudgetAllocation, ConnectToHub, NoHub, OnboardingFinished} from '../../dialogs';
import {FlowRouter, FlowRouterProps} from '../../flow-router/FlowRouter';
import {JsonRpcComponentProps} from '../../json-rpc-router';
import * as Onboarding from './Onboarding';
const {OnboardingFlow, OnboardingFlowPaths} = Onboarding;

Enzyme.configure({adapter: new Adapter()});

const mockRequest: JsonRpcRequest = {
  jsonrpc: '2.0',
  id: 123,
  method: 'chan_allocate',
  params: ['foo', true, 3]
};

type MockFlow = {
  flowWrapper: ReactWrapper;
  flowContext: jest.SpyInstance<JsonRpcComponentProps>;
  flowRouter: ReactWrapper<FlowRouterProps>;
  budgetAllocationComponent: ReactWrapper<RouteComponentProps>;
  noHubComponent: ReactWrapper<RouteComponentProps>;
  connectToHubComponent: ReactWrapper<RouteComponentProps>;
  onboardingFinished: ReactWrapper<RouteComponentProps>;
  history: History;
};

const mockFlow = (): MockFlow => {
  const flow = mount(<OnboardingFlow request={mockRequest} />);

  return refreshFlowFrom(flow);
};

const refreshFlowFrom = (flowWrapper: ReactWrapper): MockFlow => {
  flowWrapper.update();

  const flowContext = jest
    .spyOn(Onboarding, 'useOnboardingFlowContext')
    .mockImplementation(() => ({request: mockRequest}));

  return {
    flowWrapper,
    flowContext,
    flowRouter: flowWrapper.find(FlowRouter),
    budgetAllocationComponent: flowWrapper.find(BudgetAllocation),
    noHubComponent: flowWrapper.find(NoHub),
    connectToHubComponent: flowWrapper.find(ConnectToHub),
    onboardingFinished: flowWrapper.find(OnboardingFinished),
    history: flowWrapper.find(Router).prop('history')
  };
};

describe('Onboarding Flow', () => {
  let flow: MockFlow;

  beforeEach(() => {
    flow = mockFlow();
  });

  it('should expose a FlowRouter with the /onboarding/allocate URL as initial path', () => {
    const {flowRouter} = flow;
    expect(flowRouter.exists()).toEqual(true);
    expect(flowRouter.prop('initialPath')).toEqual(OnboardingFlowPaths.BudgetAllocation);
  });

  it('should start the flow with the BudgetAllocation dialog on /onboarding/allocate', () => {
    const {budgetAllocationComponent, history} = flow;
    expect(budgetAllocationComponent.exists()).toEqual(true);
    expect(history.location.pathname).toMatch(OnboardingFlowPaths.BudgetAllocation);
  });

  describe('should mount each component on its proper route, and expose the JsonRpcRequest in the context', () => {
    const routeCases = [
      [OnboardingFlowPaths.BudgetAllocation, true, false, false, false],
      [OnboardingFlowPaths.NoHub, false, true, false, false],
      [OnboardingFlowPaths.ConnectToHub, false, false, true, false],
      [OnboardingFlowPaths.Finished, false, false, false, true]
    ];

    it.each(routeCases)(
      '%s',
      (path, showsBudgetAllocation, showsNoHub, showsConnectToHub, showsOnboardingFinished) => {
        const {history, flowWrapper} = flow;

        history.push(path as string);
        flow = refreshFlowFrom(flowWrapper);

        const {
          budgetAllocationComponent,
          noHubComponent,
          connectToHubComponent,
          onboardingFinished,
          flowContext
        } = flow;

        expect(flowContext).toHaveBeenCalled();

        expect(budgetAllocationComponent.exists()).toEqual(showsBudgetAllocation);
        expect(noHubComponent.exists()).toEqual(showsNoHub);
        expect(connectToHubComponent.exists()).toEqual(showsConnectToHub);
        expect(onboardingFinished.exists()).toEqual(showsOnboardingFinished);
      }
    );
  });
});
