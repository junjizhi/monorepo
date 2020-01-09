// what does the messaging service look like?

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
  on: {
    '': [{ target: onSuccess, cond: checkX }],
    '*': [{ target: onSuccess, cond: checkX }],
  },
});

// how do we trigger events?
// funding increased
// funding decreased (i.e. revert)
// state received

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
