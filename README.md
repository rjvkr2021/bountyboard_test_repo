# BountyBoard merge test repository

This repository is a live test fixture for BountyBoard's GitHub merge oracle.

The workflow calls `mark_merged` on the testnet BountyBoard contract when a
pull request is merged. Pull request bodies must reference an approved bounty
with `Fixes #N`, `Closes #N`, or `Resolves #N`.

The PR author's GitHub handle must be linked to a NEAR account by the oracle
before the merge is processed.

## Secrets

- `BOUNTYBOARD_CONTRACT_ID`
- `NEAR_ORACLE_ACCOUNT`
- `NEAR_ORACLE_PRIVATE_KEY` — scoped to `mark_merged` and `mark_security_fixed`

## Variable

- `NEAR_NETWORK` — defaults to `testnet`
