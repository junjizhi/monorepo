# advance-channel

## Wire protocol

None

# conclude-channel

When my app calls `ConcludeChannel`, my wallet spawns a new `conclude-channel` process.
When my store receives a final state, it spawns a `conclude-channel` machine with the channels id.

## Wire protocol

None:

# create-channel

When my app calls `CreateChannel`, spawn a `create-channel` process.

## Wire protocol

On init:

- generate a `nonce`, and therefore a `channelId`
- send a `message` of type

```
interface OpenChannel {
  type: "Channel.Open";
  participants: ChannelParticipant[];
  signedState: SignedState;
}
```

# open-channel

When my wallet receives an `OpenChannel` message, spawn an `open-channel` protocol, which asks my app if it should open the channel through a `CHANNEL_PROPOSED` event.

My wallet sends a message of type `Response = UpdateChannel | RejectChannel`.

## Wire protocol

- If the app accepts to open the channel (`JOIN_CHANNEL`), return

```
interface UpdateChannel {
  type: "Channel.Update";
  participants: ChannelParticipant[];
  signedState: SignedState;
}
```

- if my app refuses to open the channel, it calls `ConcludeChannel`, and the join-channel protocol shuts down

# create-null-channel

None: same as above

# direct-funding

None:

- We can all predict what the pre-fund outcome should be, based on the channel's current holdings and

Breaks if:

- someone deposits out of order/the wrong amount
  - this might prevent `safeToDeposit` from ever returning `true`
  - additionally, it might cause different wallets to compute different pre-fund outcomes. This should resolve on a second try, if it happens

# funding

Starting funding: See Unknowns

Funding strategy negotiation:

```
interface Propose {
  channelId: string;
  strategy: 'direct' | 'indirect' | 'virtual'
}
```

# ledger-funding

None.

# ledger-defunding

None.

- When our wallets conclude the target channel, they both know that its funding source should be removed
- If it's directly funded, we can withdraw concurrently with no coopration
- If it's indirectly/virtually funded, we both know we'll update the ledger channel

# virtual-funding

TBD

- Should we know the hub on initialization, or should that be a part of virtual-funding protocol?

# virtual-defunding

TBD

# ledger-update

None:

- We should all have the same `nextOutcome`

# support-state

None:

- This seems to essentially supercede `ledger-update`

# Unknowns:

## Funding

- Does funding happen in a different process from `create-channel`? Or is it invoked by `create-channel`?
- Can the same protocol be used to top-up an ongoing application channel?

## Inactivity

- How do we deal with inactive peers? (See Dropped messages)

## Dropped messages

- If a simple state update is dropped, we can easily deal with this through a `request-channel-state` message instructing you to share your channel states with me.
- Should there be some kind of a `ping` message for other times of dropped messages?
  - Or should there be a confirmation response, a la TCP, to signal receipt of a message?

## "Bad" store state

- If I receive multiple states ahead of the latest supported state, how did that come to be?
  How do I get out of that situation?
  What part of the wallet guarantees my safety?
- Should there be an explicit `synchronize-channel` message, in the case of unexpected behaviour?
  - If two wallets somehow get into a bad state in a ledger channel, this can be resolved by "promoting" the latest supported state to a sufficiently large turn number.

## Agreeing on the next outcome

- Does it make sense to be explicit that we're changing the outcome to `X`, before signing the state with outcome `X`?
  - eg. do we agree to the following, before signing the channel state?

```
interface ProposeUpdate {
  type: 'LedgerUpdate'
  nextState: ChannelState
}
```

## Locking

- How do I eg. lock a ledger channel while updating its outcome, eg. as part of ledger-funding?
- If I can't sign an update due to a lock, how do I signal this?
  - In what scenarios do two wallets _not_ both have that channel locked?

## Spontaneous top-ups

- How do I indicate my desire to top-up a ledger channel, outside of a funding protocol?
  - Is there even a use-case for this?
