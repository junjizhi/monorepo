pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;

import './interfaces/IForceMove.sol';
import './interfaces/ForceMoveApp.sol';

/**
  * @dev An implementation of ForceMove protocol, which allows state channels to be adjudicated and finalized.
*/
contract ForceMove is IForceMove {
    mapping(bytes32 => bytes32) public channelStorageHashes;

    // Public methods:

    /**
    * @notice Unpacks turnNumRecord, finalizesAt and fingerprint from the channelStorageHash of a particular channel.
    * @dev Unpacks turnNumRecord, finalizesAt and fingerprint from the channelStorageHash of a particular channel.
    * @param channelId Unique identifier for a state channel.
    * @return (turnNumRecord, finalizesAt, fingerprint) -  A turnNum that (the adjudicator knows) is supported by a signature from each participant; The unix timestamp when `channelId` will finalize; Unique identifier for the channel's current state, up to hash collisions.
    */
    function getData(bytes32 channelId)
        public
        view
        returns (uint48 turnNumRecord, uint48 finalizesAt, uint160 fingerprint)
    {
        (turnNumRecord, finalizesAt, fingerprint) = _getData(channelId);
    }

    /**
    * @notice Registers a challenge against a state channel. A challenge will either prompt another participant into clearing the challenge (via one of the other methods), or cause the channel to finalize at a specific time.
    * @dev Registers a challenge against a state channel. A challenge will either prompt another participant into clearing the challenge (via one of the other methods), or cause the channel to finalize at a specific time.
    * @param fixedPart Data describing properties of the state channel that do not change with state updates.
    * @param largestTurnNum The largest turn number of the submitted states; will overwrite the stored value of `turnNumRecord`.
    * @param variableParts An ordered array of structs, each decribing the properties of the state channel that may change with each state update.
    * @param isFinalCount Describes how many of the submitted states have the `isFinal` property set to `true`. It is implied that the rightmost `isFinalCount` states are final, and the rest are not final.
    * @param sigs An array of signatures that support the state with the `largestTurnNum`.
    * @param whoSignedWhat An array denoting which participant has signed which state: `participant[i]` signed the state with index `whoSignedWhat[i]`.
    * @param challengerSig The signature of a participant on the keccak256 of the abi.encode of (supportedStateHash, 'forceMove').
    */
    function forceMove(
        FixedPart memory fixedPart,
        uint48 largestTurnNum,
        ForceMoveApp.VariablePart[] memory variableParts,
        uint8 isFinalCount, // how many of the states are final
        Signature[] memory sigs,
        uint8[] memory whoSignedWhat,
        Signature memory challengerSig
    ) public {
        bytes32 channelId = _getChannelId(fixedPart);

        if (_mode(channelId) == ChannelMode.Open) {
            _requireNonDecreasedTurnNumber(channelId, largestTurnNum);
        } else if (_mode(channelId) == ChannelMode.Challenge) {
            _requireIncreasedTurnNumber(channelId, largestTurnNum);
        } else {
            // This should revert.
            _requireChannelNotFinalized(channelId);
        }
        bytes32 supportedStateHash = _requireStateSupportedBy(
            largestTurnNum,
            variableParts,
            isFinalCount,
            channelId,
            fixedPart,
            sigs,
            whoSignedWhat
        );

        address challenger = _requireChallengerIsParticipant(
            supportedStateHash,
            fixedPart.participants,
            challengerSig
        );

        // effects
        emit ChallengeRegistered(
            channelId,
            largestTurnNum,
            now + fixedPart.challengeDuration,
            challenger,
            isFinalCount > 0,
            fixedPart,
            variableParts,
            sigs,
            whoSignedWhat
        );

        channelStorageHashes[channelId] = _hashChannelStorage(
            ChannelStorage(
                largestTurnNum,
                now + fixedPart.challengeDuration,
                supportedStateHash,
                challenger,
                keccak256(abi.encode(variableParts[variableParts.length - 1].outcome))
            )
        );

    }

    /**
    * @notice Repsonds to an ongoing challenge registered against a state channel.
    * @dev Repsonds to an ongoing challenge registered against a state channel.
    * @param challenger The address of the participant whom registered the challenge.
    * @param isFinalAB An pair of booleans describing if the challenge state and/or the response state have the `isFinal` property set to `true`.
    * @param fixedPart Data describing properties of the state channel that do not change with state updates.
    * @param variablePartAB An pair of structs, each decribing the properties of the state channel that may change with each state update (for the challenge state and for the response state).
    * @param sig The responder's signature on the `responseStateHash`.
    */
    function respond(
        address challenger,
        bool[2] memory isFinalAB,
        FixedPart memory fixedPart,
        ForceMoveApp.VariablePart[2] memory variablePartAB,
        // variablePartAB[0] = challengeVariablePart
        // variablePartAB[1] = responseVariablePart
        Signature memory sig
    ) public {
        bytes32 channelId = _getChannelId(fixedPart);
        (uint48 turnNumRecord, uint48 finalizesAt, ) = _getData(channelId);

        bytes32 challengeOutcomeHash = _hashOutcome(variablePartAB[0].outcome);
        bytes32 responseOutcomeHash = _hashOutcome(variablePartAB[1].outcome);
        bytes32 challengeStateHash = _hashState(
            turnNumRecord,
            isFinalAB[0],
            channelId,
            fixedPart,
            variablePartAB[0].appData,
            challengeOutcomeHash
        );

        bytes32 responseStateHash = _hashState(
            turnNumRecord + 1,
            isFinalAB[1],
            channelId,
            fixedPart,
            variablePartAB[1].appData,
            responseOutcomeHash
        );

        // checks

        _requireSpecificChallenge(
            ChannelStorage(
                turnNumRecord,
                finalizesAt,
                challengeStateHash,
                challenger,
                challengeOutcomeHash
            ),
            channelId
        );

        require(
            _recoverSigner(responseStateHash, sig) ==
                fixedPart.participants[(turnNumRecord + 1) % fixedPart.participants.length],
            'Response not signed by authorized mover'
        );

        _requireValidTransition(
            fixedPart.participants.length,
            isFinalAB,
            variablePartAB,
            turnNumRecord + 1,
            fixedPart.appDefinition
        );

        // effects
        _clearChallenge(channelId, turnNumRecord + 1);
    }

    /**
    * @notice Overwrites the `turnNumRecord` stored against a channel by providing a state with higher turn number, supported by a signature from each participant.
    * @dev Overwrites the `turnNumRecord` stored against a channel by providing a state with higher turn number, supported by a signature from each participant.
    * @param fixedPart Data describing properties of the state channel that do not change with state updates.
    * @param largestTurnNum The largest turn number of the submitted states; will overwrite the stored value of `turnNumRecord`.
    * @param variableParts An ordered array of structs, each decribing the properties of the state channel that may change with each state update.
    * @param isFinalCount Describes how many of the submitted states have the `isFinal` property set to `true`. It is implied that the rightmost `isFinalCount` states are final, and the rest are not final.
    * @param sigs An array of signatures that support the state with the `largestTurnNum`.
    * @param whoSignedWhat An array denoting which participant has signed which state: `participant[i]` signed the state with index `whoSignedWhat[i]`.
    */
    function checkpoint(
        FixedPart memory fixedPart,
        uint48 largestTurnNum,
        ForceMoveApp.VariablePart[] memory variableParts,
        uint8 isFinalCount, // how many of the states are final
        Signature[] memory sigs,
        uint8[] memory whoSignedWhat
    ) public {
        bytes32 channelId = _getChannelId(fixedPart);

        // checks
        _requireChannelNotFinalized(channelId);
        _requireIncreasedTurnNumber(channelId, largestTurnNum);
        _requireStateSupportedBy(
            largestTurnNum,
            variableParts,
            isFinalCount,
            channelId,
            fixedPart,
            sigs,
            whoSignedWhat
        );

        // effects
        _clearChallenge(channelId, largestTurnNum);

    }

    /**
    * @notice Finalizes a channel by providing a finalization proof.
    * @dev Finalizes a channel by providing a finalization proof.
    * @param largestTurnNum The largest turn number of the submitted states; will overwrite the stored value of `turnNumRecord`.
    * @param fixedPart Data describing properties of the state channel that do not change with state updates.
    * @param appPartHash The keccak256 of the abi.encode of `(challengeDuration, appDefinition, appData)`. Applies to all states in the finalization proof.
    * @param outcomeHash The keccak256 of the abi.encode of the `outcome`. Applies to all stats in the finalization proof.
    * @param numStates The number of states in the finalization proof.
    * @param whoSignedWhat An array denoting which participant has signed which state: `participant[i]` signed the state with index `whoSignedWhat[i]`.
    * @param sigs An array of signatures that support the state with the `largestTurnNum`.
    */
    function conclude(
        uint48 largestTurnNum,
        FixedPart memory fixedPart,
        bytes32 appPartHash,
        bytes32 outcomeHash,
        uint8 numStates,
        uint8[] memory whoSignedWhat,
        Signature[] memory sigs
    ) public {
        bytes32 channelId = _getChannelId(fixedPart);
        _requireChannelNotFinalized(channelId);

        // By construction, the following states form a valid transition
        bytes32[] memory stateHashes = new bytes32[](numStates);
        for (uint256 i = 0; i < numStates; i++) {
            stateHashes[i] = keccak256(
                abi.encode(
                    State(
                        largestTurnNum + (i + 1) - numStates, // turnNum
                        true, // isFinal
                        channelId,
                        appPartHash,
                        outcomeHash
                    )
                )
            );
        }

        // checks
        require(
            _validSignatures(
                largestTurnNum,
                fixedPart.participants,
                stateHashes,
                sigs,
                whoSignedWhat
            ),
            'Invalid signatures'
        );

        // effects
        channelStorageHashes[channelId] = _hashChannelStorage(
            ChannelStorage(0, now, bytes32(0), address(0), outcomeHash)
        );
        emit Concluded(channelId);
    }

    // Internal methods:

    /**
    * @notice Checks that the challengerSignature was created by one of the supplied participants.
    * @dev Checks that the challengerSignature was created by one of the supplied participants.
    * @param supportedStateHash Forms part of the digest to be signed, along with the string 'forceMove'.
    * @param participants A list of addresses representing the participants of a channel.
    * @param challengerSignature The signature of a participant on the keccak256 of the abi.encode of (supportedStateHash, 'forceMove').
    */
    function _requireChallengerIsParticipant(
        bytes32 supportedStateHash,
        address[] memory participants,
        Signature memory challengerSignature
    ) internal pure returns (address challenger) {
        challenger = _recoverSigner(
            keccak256(abi.encode(supportedStateHash, 'forceMove')),
            challengerSignature
        );
        require(_isAddressInArray(challenger, participants), 'Challenger is not a participant');
    }

    /**
    * @notice Tests whether a given address is in a given array of addresses.
    * @dev Tests whether a given address is in a given array of addresses.
    * @param suspect A single address of interest.
    * @param addresses A line-up of possible perpetrators.
    * @return true if the address is in the array, false otherwise
    */
    function _isAddressInArray(address suspect, address[] memory addresses)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < addresses.length; i++) {
            if (suspect == addresses[i]) {
                return true;
            }
        }
        return false;
    }

    /**
    * @notice Given an array of state hashes, checks the validity of the supplied signatures. Valid means there is a signature for each participant, either on the hash of the state for which they are a mover, or on the hash of a state that appears after that state in the array.
    * @dev Given an array of state hashes, checks the validity of the supplied signatures. Valid means there is a signature for each participant, either on the hash of the state for which they are a mover, or on the hash of a state that appears after that state in the array.
    * @param largestTurnNum The largest turn number of the submitted states; will overwrite the stored value of `turnNumRecord`.
    * @param participants A list of addresses representing the participants of a channel.
    * @param stateHashes Array of keccak256(State) submitted in support of a state,
    * @param sigs Array of Signatures, one for each participant
    * @param whoSignedWhat participant[i] signed stateHashes[whoSignedWhat[i]]
    * @return true if the signatures are valid, false otherwise
    */
    function _validSignatures(
        uint256 largestTurnNum,
        address[] memory participants,
        bytes32[] memory stateHashes,
        Signature[] memory sigs,
        uint8[] memory whoSignedWhat // whoSignedWhat[i] is the index of the state in stateHashes that was signed by participants[i]
    ) internal pure returns (bool) {
        uint256 nParticipants = participants.length;
        uint256 nStates = stateHashes.length;

        require(
            _acceptableWhoSignedWhat(whoSignedWhat, largestTurnNum, nParticipants, nStates),
            'Unacceptable whoSignedWhat array'
        );
        for (uint256 i = 0; i < nParticipants; i++) {
            address signer = _recoverSigner(stateHashes[whoSignedWhat[i]], sigs[i]);
            if (signer != participants[i]) {
                return false;
            }
        }
        return true;
    }

    /**
    * @notice Given a declaration of which state in the support proof was signed by which participant, check if this declaration is acceptable. Acceptable means there is a signature for each participant, either on the hash of the state for which they are a mover, or on the hash of a state that appears after that state in the array.
    * @dev Given a declaration of which state in the support proof was signed by which participant, check if this declaration is acceptable. Acceptable means there is a signature for each participant, either on the hash of the state for which they are a mover, or on the hash of a state that appears after that state in the array.
    * @param whoSignedWhat participant[i] signed stateHashes[whoSignedWhat[i]]
    * @param largestTurnNum Largest turnNum of the support proof
    * @param nParticipants Number of participants in the channel
    * @param nStates Number of states in the support proof
    * @return true if whoSignedWhat is acceptable, false otherwise
    */
    function _acceptableWhoSignedWhat(
        uint8[] memory whoSignedWhat,
        uint256 largestTurnNum,
        uint256 nParticipants,
        uint256 nStates
    ) internal pure returns (bool) {
        require(
            whoSignedWhat.length == nParticipants,
            '_validSignatures: whoSignedWhat must be the same length as participants'
        );
        for (uint256 i = 0; i < nParticipants; i++) {
            uint256 offset = (nParticipants + largestTurnNum - i) % nParticipants;
            // offset is the difference between the index of participant[i] and the index of the participant who owns the largesTurnNum state
            // the additional nParticipants in the dividend ensures offset always positive
            if (whoSignedWhat[i] + offset < nStates - 1) {
                return false;
            }
        }
        return true;
    }

    bytes constant prefix = '\x19Ethereum Signed Message:\n32';
    /**
    * @notice Given a digest and ethereum digital signature, recover the signer
    * @dev Given a digest and digital signature, recover the signer
    * @param _d message digest
    * @param sig ethereum digital signature
    * @return signer
    */
    function _recoverSigner(bytes32 _d, Signature memory sig) internal pure returns (address) {
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, _d));
        address a = ecrecover(prefixedHash, sig.v, sig.r, sig.s);
        return (a);
    }


    /**
    * @notice Check that the submitted data constitute a support proof.
    * @dev Check that the submitted data constitute a support proof.
    * @param largestTurnNum Largest turnNum of the support proof
    * @param variableParts Variable parts of the states in the support proof
    * @param isFinalCount How many of the states are final? The final isFinalCount states are implied final, the remainder are implied not final.
    * @param channelId Unique identifier for a channel.
    * @param fixedPart Fixed Part of the states in the support proof
    * @param sigs A signature from each participant.
    * @param whoSignedWhat participant[i] signed stateHashes[whoSignedWhat[i]]
    * @return The hash of the latest state in the proof, if supported, else reverts.
    */
    function _requireStateSupportedBy(
        uint256 largestTurnNum,
        ForceMoveApp.VariablePart[] memory variableParts,
        uint8 isFinalCount,
        bytes32 channelId,
        FixedPart memory fixedPart,
        Signature[] memory sigs,
        uint8[] memory whoSignedWhat
    ) internal pure returns (bytes32) {
        bytes32[] memory stateHashes = _requireValidTransitionChain(
            largestTurnNum,
            variableParts,
            isFinalCount,
            channelId,
            fixedPart
        );

        require(
            _validSignatures(
                largestTurnNum,
                fixedPart.participants,
                stateHashes,
                sigs,
                whoSignedWhat
            ),
            'Invalid signatures'
        );

        return stateHashes[stateHashes.length - 1];
    }

    /**
    * @notice Check that the submitted states form a chain of valid transitions
    * @dev Check that the submitted states form a chain of valid transitions
    * @param largestTurnNum Largest turnNum of the support proof
    * @param variableParts Variable parts of the states in the support proof
    * @param isFinalCount How many of the states are final? The final isFinalCount states are implied final, the remainder are implied not final.
    * @param channelId Unique identifier for a channel.
    * @param fixedPart Fixed Part of the states in the support proof
    * @return true if every state is a validTransition from its predecessor, false otherwise.
    */
    function _requireValidTransitionChain(
        // returns stateHashes array if valid
        // else, reverts
        uint256 largestTurnNum,
        ForceMoveApp.VariablePart[] memory variableParts,
        uint8 isFinalCount,
        bytes32 channelId,
        FixedPart memory fixedPart
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory stateHashes = new bytes32[](variableParts.length);
        uint256 firstFinalTurnNum = largestTurnNum - isFinalCount + 1;
        uint256 turnNum;

        for (uint256 i = 0; i < variableParts.length; i++) {
            turnNum = largestTurnNum - variableParts.length + 1 + i;
            stateHashes[i] = _hashState(
                turnNum,
                turnNum >= firstFinalTurnNum,
                channelId,
                fixedPart,
                variableParts[i].appData,
                _hashOutcome(variableParts[i].outcome)
            );
            if (turnNum < largestTurnNum) {
                _requireValidTransition(
                    fixedPart.participants.length,
                    [turnNum >= firstFinalTurnNum, turnNum + 1 >= firstFinalTurnNum],
                    [variableParts[i], variableParts[i + 1]],
                    turnNum + 1,
                    fixedPart.appDefinition
                );
            }
        }
        return stateHashes;
    }


    /**
    * @notice Check that the submitted pair of states form a valid transition
    * @dev Check that the submitted pair of states form a valid transition
    * @param nParticipants Number of participants in the channel.
    transition
    * @param isFinalAB Pair of booleans denoting whether the first and second state (resp.) are final.
    * @param ab Variable parts of each of the pair of states
    * @param turnNumB turnNum of the later state of the pair.
    * @param appDefinition Address of deployed contract containing application-specific validTransition function.
    * @return true if the later state is a validTransition from its predecessor, false otherwise.
    */
    function _requireValidTransition(
        uint256 nParticipants,
        bool[2] memory isFinalAB, // [a.isFinal, b.isFinal]
        ForceMoveApp.VariablePart[2] memory ab, // [a,b]
        uint256 turnNumB,
        address appDefinition
    ) internal pure returns (bool) {
        // a prior check on the signatures for the submitted states implies that the following fields are equal for a and b:
        // chainId, participants, channelNonce, appDefinition, challengeDuration
        // and that the b.turnNum = a.turnNum + 1
        if (isFinalAB[1]) {
            require(
                _bytesEqual(ab[1].outcome, ab[0].outcome),
                'InvalidTransitionError: Cannot move to a final state with a different default outcome'
            );
        } else {
            require(
                !isFinalAB[0],
                'InvalidTransitionError: Cannot move from a final state to a non final state'
            );
            if (turnNumB < 2 * nParticipants) {
                require(
                    _bytesEqual(ab[1].outcome, ab[0].outcome),
                    'InvalidTransitionError: Cannot change the default outcome during setup phase'
                );
                require(
                    keccak256(ab[1].appData) == keccak256(ab[0].appData),
                    'InvalidTransitionError: Cannot change the appData during setup phase'
                );
            } else {
                require(
                    ForceMoveApp(appDefinition).validTransition(
                        ab[0],
                        ab[1],
                        turnNumB,
                        nParticipants
                    )
                );
                // reason string not necessary (called function will provide reason for reverting)
            }
        }
        return true;
    }

    /**
    * @notice Check for equality of two byte strings
    * @dev Check for equality of two byte strings
    * @param left One bytes string
    * @param right The other bytes string
    * @return true if the bytes are identical, false otherwise.
    */
    function _bytesEqual(bytes memory left, bytes memory right) internal pure returns (bool) {
        return keccak256(left) == keccak256(right);
    }

    /**
    * @notice Clears a challenge by updating the turnNumRecord and resetting the remaining channel storage fields, and emits a ChallengeCleared event.
    * @dev Clears a challenge by updating the turnNumRecord and resetting the remaining channel storage fields, and emits a ChallengeCleared event.
    * @param channelId Unique identifier for a channel.
    * @param newTurnNumRecord New turnNumRecord to overwrite existing value
    */
    function _clearChallenge(bytes32 channelId, uint256 newTurnNumRecord) internal {
        channelStorageHashes[channelId] = _hashChannelStorage(
            ChannelStorage(newTurnNumRecord, 0, bytes32(0), address(0), bytes32(0))
        );
        emit ChallengeCleared(channelId, newTurnNumRecord);
    }

    /**
    * @notice Checks that the submitted turnNumRecord is strictly greater than the turnNumRecord stored on chain.
    * @dev Checks that the submitted turnNumRecord is strictly greater than the turnNumRecord stored on chain.
    * @param channelId Unique identifier for a channel.
    * @param newTurnNumRecord New turnNumRecord intended to overwrite existing value
    */
    function _requireIncreasedTurnNumber(bytes32 channelId, uint48 newTurnNumRecord) internal view {
        (uint48 turnNumRecord, , ) = _getData(channelId);
        require(newTurnNumRecord > turnNumRecord, 'turnNumRecord not increased.');
    }

    /**
    * @notice Checks that the submitted turnNumRecord is greater than or equal to the turnNumRecord stored on chain.
    * @dev Checks that the submitted turnNumRecord is greater than or equal to the turnNumRecord stored on chain.
    * @param channelId Unique identifier for a channel.
    * @param newTurnNumRecord New turnNumRecord intended to overwrite existing value
    */
    function _requireNonDecreasedTurnNumber(bytes32 channelId, uint48 newTurnNumRecord)
        internal
        view
    {
        (uint48 turnNumRecord, , ) = _getData(channelId);
        require(newTurnNumRecord >= turnNumRecord, 'turnNumRecord decreased.');
    }

    /**
    * @notice Checks that a given ChannelStorage struct matches the challenge stored on chain, and that the channel is in Challenge mode.
    * @dev Checks that a given ChannelStorage struct matches the challenge stored on chain, and that the channel is in Challenge mode.
    * @param cs A given ChannelStorage data structure.
    * @param channelId Unique identifier for a channel.
    */
    function _requireSpecificChallenge(ChannelStorage memory cs, bytes32 channelId) internal view {
        _requireMatchingStorage(cs, channelId);
        _requireOngoingChallenge(channelId);
    }


    /**
    * @notice Checks that a given channel is in the Challenge mode.
    * @dev Checks that a given channel is in the Challenge mode.
    * @param channelId Unique identifier for a channel.
    */
    function _requireOngoingChallenge(bytes32 channelId) internal view {
        require(_mode(channelId) == ChannelMode.Challenge, 'No ongoing challenge.');
    }

    /**
    * @notice Checks that a given channel is NOT in the Finalized mode.
    * @dev Checks that a given channel is in the Challenge mode.
    * @param channelId Unique identifier for a channel.
    */
    function _requireChannelNotFinalized(bytes32 channelId) internal view {
        require(_mode(channelId) != ChannelMode.Finalized, 'Channel finalized.');
    }

    /**
    * @notice Checks that a given channel is in the Finalized mode.
    * @dev Checks that a given channel is in the Challenge mode.
    * @param channelId Unique identifier for a channel.
    */
    function _requireChannelFinalized(bytes32 channelId) internal view {
        require(_mode(channelId) == ChannelMode.Finalized, 'Channel not finalized.');
    }

    /**
    * @notice Checks that a given channel is in the Open mode.
    * @dev Checks that a given channel is in the Challenge mode.
    * @param channelId Unique identifier for a channel.
    */
    function _requireChannelOpen(bytes32 channelId) internal view {
        require(_mode(channelId) == ChannelMode.Open, 'Channel not open.');
    }

    /**
    * @notice Checks that a given ChannelStorage struct matches the challenge stored on chain.
    * @dev Checks that a given ChannelStorage struct matches the challenge stored on chain.
    * @param cs A given ChannelStorage data structure.
    * @param channelId Unique identifier for a channel.
    */
    function _requireMatchingStorage(ChannelStorage memory cs, bytes32 channelId) internal view {
        require(
            _matchesHash(cs, channelStorageHashes[channelId]),
            'Channel storage does not match stored version.'
        );
    }

    /**
    * @notice Computes the ChannelMode for a given channelId.
    * @dev Computes the ChannelMode for a given channelId.
    * @param channelId Unique identifier for a channel.
    */
    function _mode(bytes32 channelId) internal view returns (ChannelMode) {
        // Note that _getData(someRandomChannelId) returns (0,0,0), which is
        // correct when nobody has written to storage yet.

        (, uint48 finalizesAt, ) = _getData(channelId);
        if (finalizesAt == 0) {
            return ChannelMode.Open;
        } else if (finalizesAt <= now) {
            return ChannelMode.Finalized;
        } else {
            return ChannelMode.Challenge;
        }
    }

    /**
    * @notice Hashes the input data and formats it for on chain storage.
    * @dev Hashes the input data and formats it for on chain storage.
    * @param channelStorage ChannelStorage data.
    */
    function _hashChannelStorage(ChannelStorage memory channelStorage)
        internal
        pure
        returns (bytes32 newHash)
    {
        // The hash is constructed from left to right.
        uint256 result;
        uint16 cursor = 256;

        // Shift turnNumRecord 208 bits left to fill the first 48 bits
        result = uint256(channelStorage.turnNumRecord) << (cursor -= 48);

        // logical or with finalizesAt padded with 160 zeros to get the next 48 bits
        result |= (channelStorage.finalizesAt << (cursor -= 48));

        // logical or with the last 160 bits of the hash of the encoded storage
        result |= uint256(uint160(uint256(keccak256(abi.encode(channelStorage)))));

        newHash = bytes32(result);
    }

    /**
    * @notice Unpacks turnNumRecord, finalizesAt and fingerprint from the channelStorageHash of a particular channel.
    * @dev Unpacks turnNumRecord, finalizesAt and fingerprint from the channelStorageHash of a particular channel.
    * @param channelId Unique identifier for a state channel.
    * @return (turnNumRecord, finalizesAt, fingerprint) -  A turnNum that (the adjudicator knows) is supported by a signature from each participant; The unix timestamp when `channelId` will finalize; Unique identifier for the channel's current state, up to hash collisions.
    */
    function _getData(bytes32 channelId)
        internal
        view
        returns (uint48 turnNumRecord, uint48 finalizesAt, uint160 fingerprint)
    {
        bytes32 storageHash = channelStorageHashes[channelId];
        uint16 cursor = 256;
        turnNumRecord = uint48(uint256(storageHash) >> (cursor -= 48));
        finalizesAt = uint48(uint256(storageHash) >> (cursor -= 48));
        fingerprint = uint160(uint256(storageHash));
    }

    /**
    * @notice Checks that a given ChannelStorage struct matches a supplied bytes32 when formatted for storage.
    * @dev Checks that a given ChannelStorage struct matches a supplied bytes32 when formatted for storage.
    * @param cs A given ChannelStorage data structure.
    * @param h Some data in on-chain storage format.
    */
    function _matchesHash(ChannelStorage memory cs, bytes32 h) internal pure returns (bool) {
        return _hashChannelStorage(cs) == h;
    }

    /**
    * @notice Computes the hash of the state corresponding to the input data.
    * @dev Computes the hash of the state corresponding to the input data.
    * @param turnNum Turn number
    * @param isFinal Is the state final?
    * @param channelId Unique identifier for the channel
    * @param fixedPart Part of the state that does not change
    * @param appData Application specific date
    * @param outcomeHash Hash of the outcome.
    * @return The stateHash
    */
    function _hashState(
        uint256 turnNum,
        bool isFinal,
        bytes32 channelId,
        FixedPart memory fixedPart,
        bytes memory appData,
        bytes32 outcomeHash
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    State(
                        turnNum,
                        isFinal,
                        channelId,
                        keccak256(
                            abi.encode(
                                fixedPart.challengeDuration,
                                fixedPart.appDefinition,
                                appData
                            )
                        ),
                        outcomeHash
                    )
                )
            );
    }

    /**
    * @notice Computes the hash of a given outcome.
    * @dev Computes the hash of a given outcome.
    * @param outcome An outcome
    * @return The outcomeHash
    */
    function _hashOutcome(bytes memory outcome) internal pure returns (bytes32) {
        return keccak256(abi.encode(outcome));
    }

    /**
    * @notice Computes the unique id of a channel.
    * @dev Computes the unique id of a channel.
    * @param fixedPart Part of the state that does not change
    * @return The channelId
    */
    function _getChannelId(FixedPart memory fixedPart) internal pure returns (bytes32 channelId) {
        channelId = keccak256(
            abi.encode(fixedPart.chainId, fixedPart.participants, fixedPart.channelNonce)
        );
    }

    // events
    event ChallengeRegistered(
        bytes32 indexed channelId,
        // everything needed to respond or checkpoint
        uint256 turnNumRecord,
        uint256 finalizesAt,
        address challenger,
        bool isFinal,
        FixedPart fixedPart,
        ForceMoveApp.VariablePart[] variableParts,
        Signature[] sigs,
        uint8[] whoSignedWhat
    );

    event ChallengeCleared(bytes32 indexed channelId, uint256 newTurnNumRecord);
    event Concluded(bytes32 indexed channelId);
}
