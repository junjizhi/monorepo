import {addStoriesFromScenario as addStories} from "../../../../__stories__";

import {LedgerTopUp} from "../container";

import * as scenarios from "./scenarios";

addStories(scenarios.playerAHappyPath, "Ledger Top Up / Player A Happy Path", LedgerTopUp);
