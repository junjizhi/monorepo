const ensureX = (taskComplete: string, { onSuccess }: { onSuccess: string }) => ({
  initial: 'perform',
  states: {
    perform: {
      on: {
        '': [{ target: 'success', cond: taskComplete }],
        '*': [{ target: 'success', cond: taskComplete }],
      },
    },
    success: { type: 'final' },
  },
  onDone: onSuccess,
});

const awaitX = (checkX: string, { onSuccess }: { onSuccess: string }) => ({
  initial: 'wait',
  states: {
    wait: {
      on: {
        '': [{ target: 'success', cond: checkX }],
        '*': [{ target: 'success', cond: checkX }],
      },
    },
    success: { type: 'final' },
  },
  onDone: onSuccess,
});

const createAndFundLedger = {
  context: {
    me: '0x123',
    participants: [],
    nonce: 1,
    balances: [],
  },
  initial: 'ensureMyPreFS',
  states: {
    ensureMyPreFS: ensureX('myPreFSExists', { onSuccess: 'awaitFullPreFS' }),
    awaitFullPreFS: awaitX('fullPreFSExists', { onSuccess: 'awaitMyTurn' }),
    awaitMyTurn: awaitX('myTurnToDeposit', { onSuccess: 'ensureMyDeposit' }),
    ensureMyDeposit: ensureX('myDepositExists', { onSuccess: 'awaitAllDeposits' }),
    awaitAllDeposits: awaitX('allDepositsExist', { onSuccess: 'ensureMyPostFS' }),
    ensureMyPostFS: ensureX('myPostFSExists', { onSuccess: 'awaitFullPostFS' }),
    awaitFullPostFS: awaitX('fullPostFSExists', { onSuccess: 'success' }),
    success: { type: 'final' },
  },
};

export const config = createAndFundLedger;

const guards = {
  myPreFSExists: () => true,
  fullPreFSExists: () => true,
  myTurnToDeposit: () => true,
  myDepositExists: () => true,
  allDepositsExist: () => true,
  myPostFSExists: () => true,
  fullPostFSExists: () => true,
};

export const mockOptions = { guards };

// how do we make this idempotent?

// how do we handle the transitions

// observables
