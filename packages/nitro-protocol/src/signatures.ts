import {Wallet, utils} from 'ethers';
import {hashChallengeMessage} from './contract/challenge';
import {getChannelId} from './contract/channel';
import {hashState, State} from './contract/state';
import {SignedState} from '.';

export function getStateSignerAddress(signedState: SignedState): string {
  if (signedState.signatures.length !== 1) {
    throw new Error('Can only get signer address when there is 1 signature.');
  }
  const stateHash = hashState(signedState.state);
  const recoveredAddress = utils.verifyMessage(
    utils.arrayify(stateHash),
    signedState.signatures[0]
  );
  const {channel} = signedState.state;
  const {participants} = channel;

  if (participants.indexOf(recoveredAddress) < 0) {
    throw new Error(
      `Recovered address ${recoveredAddress} is not a participant in channel ${getChannelId(
        channel
      )}`
    );
  }
  return recoveredAddress;
}

export function signState(state: State, privateKey: string): SignedState {
  const wallet = new Wallet(privateKey);
  if (state.channel.participants.indexOf(wallet.address) < 0) {
    throw new Error("The state must be signed with a participant's private key");
  }

  const hashedState = hashState(state);

  const signature = signData(hashedState, privateKey);
  return {state, signatures: [signature]};
}

export function signChallengeMessage(
  signedStates: SignedState[],
  privateKey: string
): utils.Signature {
  if (signedStates.length === 0) {
    throw new Error('At least one signed state must be provided');
  }
  const wallet = new Wallet(privateKey);
  if (signedStates[0].state.channel.participants.indexOf(wallet.address) < 0) {
    throw new Error("The state must be signed with a participant's private key");
  }
  const challengeState = signedStates[signedStates.length - 1].state;
  const challengeHash = hashChallengeMessage(challengeState);

  return signData(challengeHash, privateKey);
}

function signData(hashedData: string, privateKey: string): utils.Signature {
  const signingKey = new utils.SigningKey(privateKey);
  return utils.splitSignature(signingKey.signDigest(utils.hashMessage(utils.arrayify(hashedData))));
}
