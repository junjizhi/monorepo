const UserFriendlyErrors = {
  '-32100': 'You need to approve a budget allocation in order to proceed with the download'
};

export const getUserFriendlyError = (code: number) => {
  if (UserFriendlyErrors[code]) {
    return UserFriendlyErrors[code];
  }
  return `Unhandled Error - Code ${code}`;
};

export const connectToWallet = async () => {
  const wallet = window.channelProvider;

  try {
    await wallet.enable(process.env.REACT_APP_EMBEDDED_WALLET_URL);
  } catch (error) {
    console.log('Error while connecting to wallet');
    console.log(error.stack);
  }
};

export async function makeWalletRequest(
  method: string = 'chan_allocate',
  params: Array<string | number | boolean> = ['foo', 'bar', 3, false]
) {
  const wallet = window.channelProvider;

  try {
    return wallet.send(method, params);
  } catch (error) {
    console.log('Error while making request to wallet');
    console.log(error.stack);
    return Promise.reject(error);
  }
}

export async function askForFunds() {
  await connectToWallet();
  return makeWalletRequest();
}
