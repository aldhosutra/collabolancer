const { BaseAsset } = require("lisk-sdk");
const { COLLABOLANCER_VOTE_DISPUTE_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const ACCOUNT = require("../constants/account_type");
const { VoteDisputeAssetSchema } = require("../schemas/asset");
const { setDisputeById, getDisputeById } = require("../utils/chain_state");

class VoteDisputeAsset extends BaseAsset {
  name = "voteDispute";
  id = COLLABOLANCER_VOTE_DISPUTE_ASSET_ID;
  schema = VoteDisputeAssetSchema;

  validate({ asset }) {
    if (!asset.disputeId || typeof asset.disputeId !== "string") {
      throw new Error(
        `Invalid "asset.disputeId" defined on transaction: Valid string is expected`
      );
    }
    if (
      !asset.voteFor ||
      typeof asset.voteFor !== "string" ||
      !["litigant", "defendant"].includes(asset.voteFor)
    ) {
      throw new Error(
        `Invalid "asset.voteFor" defined on transaction: Valid string is expected and must be either 'litigant' or 'defendant'`
      );
    }
    if (
      !asset.timestamp ||
      typeof asset.timestamp !== "number" ||
      asset.timestamp > Date.now()
    ) {
      throw new Error(
        `Invalid "asset.timestamp" defined on transaction: Valid number is expected and can't be in the future`
      );
    }
  }

  async apply({ asset, stateStore, reducerHandler, transaction }) {
    const senderAddress = transaction.senderAddress;
    const senderAccount = await stateStore.account.get(senderAddress);
    const dispute = await getDisputeById(stateStore, asset.disputeId);

    if (!dispute) {
      throw new Error("Dispute data doesn't exists");
    }

    if (dispute.status !== STATUS.DISPUTE.OPEN) {
      throw new Error(
        `Dispute status is not ${STATUS.DISPUTE.OPEN}, therefore you can't cast a vote`
      );
    }

    if (senderAccount.collabolancer.accountType !== ACCOUNT.SOLVER) {
      throw new Error("Sender must be an Solver");
    }

    if (
      dispute.vote.litigant.includes(senderAddress) ||
      dispute.vote.defendant.includes(senderAddress)
    ) {
      throw new Error("This Solver already voted for this dispute");
    }

    if (asset.timestamp > dispute.timestamp + dispute.maxDays * 86400) {
      throw new Error("maxDays is passed, can't cast vote again");
    }

    dispute.vote[asset.voteFor].unshift(senderAddress);
    await setDisputeById(stateStore, dispute.id, dispute);

    senderAccount.collabolancer.solver.log.unshift({
      timestamp: asset.timestamp,
      assetType: COLLABOLANCER_VOTE_DISPUTE_ASSET_ID,
      value: BigInt(0) - BigInt(dispute.castVoteFee),
      id: transaction.id,
    });
    senderAccount.collabolancer.solver.earning -= BigInt(dispute.castVoteFee);
    senderAccount.collabolancer.solver.vote.unshift(dispute.id);

    await reducerHandler.invoke("token:debit", {
      address: senderAddress,
      amount: dispute.castVoteFee,
    });
    await stateStore.account.set(senderAccount.address, senderAccount);
  }
}

module.exports = { VoteDisputeAsset };
