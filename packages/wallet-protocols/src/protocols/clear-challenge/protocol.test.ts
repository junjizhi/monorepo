import { interpret } from 'xstate';
import waitForExpect from 'wait-for-expect';

import { Chain } from '../../chain';
import { EphemeralStore } from '../..';
import { storeWithFundedChannel, appState } from '../../__tests__/data';
import { SignedState } from '../../types';

// import { machine, Init } from './protocol';
const machine: any = {};

it('handles the basic case going first', async () => {
  const privateKey = '0x95942b296854c97024ca3145abef8930bf329501b718c0f66d57dba596ff1318';
  const chain = new Chain();
  const store = new EphemeralStore({ ...storeWithFundedChannel(privateKey), chain });
  interpret(machine(store)).start();

  const challengeState = { ...appState, turnNum: 1 };
  const staleSupport: SignedState[] = [{ state: challengeState, signatures: [] }];
  chain.forceMove(staleSupport, 'sig' as any);

  /*
  For starters, it should:
  1. Observe the challenged channel
  2. Notice a supported state with a greater turn number
  3. Submit a checkpoint transaction with the newer supported state
  */

  await waitForExpect(
    () =>
      expect(chain.checkpoint).toHaveBeenCalledWith([{ state: appState, signatures: ['TODO'] }]),
    2000
  );
});
