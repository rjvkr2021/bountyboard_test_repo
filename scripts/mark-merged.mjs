import {
  Account,
  JsonRpcProvider,
  KeyPairSigner,
  actions,
} from "near-api-js";

const TGAS = 1_000_000_000_000n;
const LINKED_ISSUE =
  /\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s*:?\s*#(\d+)\b/i;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseLinkedIssue(body) {
  const withoutCode = body.replace(/```[\s\S]*?```/g, " ");
  const match = LINKED_ISSUE.exec(withoutCode);
  if (!match?.[1]) {
    return null;
  }
  const issueNumber = Number(match[1]);
  return Number.isSafeInteger(issueNumber) && issueNumber > 0
    ? issueNumber
    : null;
}

async function main() {
  const network = process.env.NEAR_NETWORK || "testnet";
  const rpcUrl =
    process.env.NEAR_RPC_URL || `https://rpc.${network}.fastnear.com`;
  const contractId = required("BOUNTYBOARD_CONTRACT_ID");
  const oracleAccount = required("NEAR_ORACLE_ACCOUNT");
  const oracleSecret = required("NEAR_ORACLE_PRIVATE_KEY");
  const prBody = process.env.PR_BODY || "";
  const prNumber = Number(required("PR_NUMBER"));
  const prAuthor = required("PR_AUTHOR");
  const mergeCommit = required("PR_MERGE_COMMIT");

  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    throw new Error(`Invalid PR_NUMBER: ${process.env.PR_NUMBER}`);
  }

  const issueNumber = parseLinkedIssue(prBody);
  if (issueNumber === null) {
    throw new Error("PR body does not contain Fixes/Closes/Resolves #N");
  }

  const provider = new JsonRpcProvider({ url: rpcUrl });
  const issueId = await provider.callFunction({
    contractId,
    method: "get_issue_id_by_number",
    args: { issue_number: issueNumber },
  });
  if (issueId === null) {
    throw new Error(`No bounty found for issue #${issueNumber}`);
  }

  const issue = await provider.callFunction({
    contractId,
    method: "get_issue",
    args: { issue_id: issueId },
  });
  if (!issue) {
    throw new Error(`No bounty found for issue #${issueNumber}`);
  }
  if (issue.kind !== "PublicIssue") {
    throw new Error(
      `Issue #${issueNumber} is not a public bounty; use mark_security_fixed`,
    );
  }
  if (issue.status !== "Approved") {
    throw new Error(
      `Issue #${issueNumber} is ${issue.status}, expected Approved`,
    );
  }

  const signer = KeyPairSigner.fromSecretKey(oracleSecret);
  const account = new Account(oracleAccount, provider, signer);
  const result = await account.signAndSendTransaction({
    receiverId: contractId,
    actions: [
      actions.functionCall(
        "mark_merged",
        {
          issue_id: issueId,
          pr_number: prNumber,
          pr_author_handle: prAuthor,
          commit: mergeCommit,
        },
        30n * TGAS,
        0n,
      ),
    ],
    throwOnFailure: true,
  });

  const explorer =
    network === "mainnet"
      ? "https://nearblocks.io/txns/"
      : "https://testnet.nearblocks.io/txns/";
  console.log(`Marked issue #${issueNumber} merged`);
  console.log(`${explorer}${result.transaction.hash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
