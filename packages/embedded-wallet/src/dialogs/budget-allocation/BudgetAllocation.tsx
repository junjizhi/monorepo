import debug from 'debug';
import React, {Dispatch, SetStateAction, useEffect, useState} from 'react';
import {Redirect, RouteComponentProps} from 'react-router';
import {OnboardingFlowPaths, useOnboardingFlowContext} from '../../flows';
import {JsonRpcComponentProps} from '../../json-rpc-router';
import {closeWallet, rejectAllocation} from '../../message-dispatchers';
import {Dialog, Slider} from '../../ui';
import {Expandable} from '../../ui/expandable/Expandable';

const log = debug('wallet:budget-allocation');

const allow = (amountToAllocate: number, useRedirect: Dispatch<SetStateAction<boolean>>) => () => {
  log("`Allow` clicked: I'll allow it, with %o ETH", amountToAllocate);
  log('Handing off to NoHub');
  useRedirect(true);
};

const reject = (onboardingFlowContext: JsonRpcComponentProps) => () => {
  log('`Reject` clicked: You shall not pass.');
  rejectAllocation(onboardingFlowContext.request.id as number);
  closeWallet();
};

const BudgetAllocation: React.FC<RouteComponentProps> = () => {
  const [amountToAllocate, setAmountToAllocate] = useState<number>(0.2);
  const [redirect, useRedirect] = useState<boolean>(false);
  const onboardingFlowContext = useOnboardingFlowContext();

  useEffect(() => {
    log('Initiated flow step with request %o', onboardingFlowContext.request);
  }, [onboardingFlowContext.request]);

  return (
    <Dialog
      title="statechannels.com want to allocate"
      onClose={closeWallet}
      buttons={{
        primary: {
          label: `Allow ${amountToAllocate} ETH`,
          onClick: allow(amountToAllocate, useRedirect)
        },
        secondary: {label: 'Reject', onClick: reject(onboardingFlowContext)}
      }}
    >
      {redirect ? <Redirect to={OnboardingFlowPaths.NoHub} /> : null}
      <div>
        Recommended amount: <strong>0.2 ETH</strong> of your send.
      </div>
      <Expandable title="Customize">
        <Slider
          initialValue={0.2}
          min={0}
          max={2}
          unit="ETH"
          step={0.01}
          onChange={setAmountToAllocate}
        />
      </Expandable>
    </Dialog>
  );
};

export {BudgetAllocation};
