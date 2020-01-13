import {combineReducers} from 'redux';

import {loginReducer, LoginState} from './login/reducer';
import {MetamaskState, metamaskReducer} from './metamask/reducer';
import {OpenGameState} from './open-games/state';
import {openGamesReducer} from './open-games/reducer';
import {overlayReducer} from './global/reducer';
import {OverlayState} from './global/state';
import {GameState} from './game/state';
import {gameReducer} from './game/reducer';
import {WalletState, walletReducer} from './wallet/reducer';
import {AutoPlayerState} from './auto-player/state';
import {autoPlayerReducer} from './auto-player/reducer';

export interface SiteState {
  login: LoginState;
  metamask: MetamaskState;
  wallet: WalletState;
  openGames: OpenGameState;
  game: GameState;
  overlay: OverlayState;
  autoPlayer: AutoPlayerState;
}

export default combineReducers<SiteState>({
  login: loginReducer,
  metamask: metamaskReducer,
  wallet: walletReducer,
  openGames: openGamesReducer,
  game: gameReducer,
  overlay: overlayReducer,
  autoPlayer: autoPlayerReducer,
});
