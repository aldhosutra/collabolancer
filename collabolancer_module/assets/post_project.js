const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const { COLLABOLANCER_POST_PROJECT_ASSET_ID } = require("../constants/id");
const MISCELLANEOUS = require("../constants/miscellaneous");
const STATUS = require("../constants/status");
const { PostProjectAssetSchema } = require("../schemas/asset");
const {
  generateID,
  setAllProject,
  getAllProject,
  setProjectById,
} = require("../utils/chain_state");

class PostProjectAsset extends BaseAsset {
  name = "postProject";
  id = COLLABOLANCER_POST_PROJECT_ASSET_ID;
  schema = PostProjectAssetSchema;

  validate({ asset }) {
    if (!asset.title || typeof asset.title !== "string") {
      throw new Error(
        `Invalid "asset.title" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.description || typeof asset.description !== "string") {
      throw new Error(
        `Invalid "asset.description" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.category || typeof asset.category !== "string") {
      throw new Error(
        `Invalid "asset.category" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.prize || typeof asset.prize !== "string") {
      throw new Error(
        `Invalid "asset.prize" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.maxTime || typeof asset.maxTime !== "number") {
      throw new Error(
        `Invalid "asset.maxTime" defined on transaction: Valid number is expected`
      );
    }
    if (!asset.maxRevision || typeof asset.maxRevision !== "number") {
      throw new Error(
        `Invalid "asset.maxRevision" defined on transaction: Valid number is expected`
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
    const allProject = await getAllProject(stateStore);

    if (senderAccount.collabolancer.accountType !== ACCOUNT.EMPLOYER) {
      throw new Error("Sender must be an Employer");
    }

    const id = generateID(senderAddress, transaction.nonce);

    const ProjectAsset = {
      id: id,
      employer: senderAddress,
      title: asset.title,
      description: asset.description,
      category: asset.category,
      prize: BigInt(asset.prize),
      freezedFund: BigInt(asset.prize),
      freezedFee:
        (BigInt(asset.prize) *
          BigInt(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERMYRIAD)) /
        BigInt(10000),
      cashback: BigInt(0),
      maxTime: asset.maxTime,
      maxRevision: asset.maxRevision,
      status: STATUS.PROJECT.OPEN,
      statusNote: [],
      submission: [],
      winner: "",
      guilty: false,
      terminated: false,
      postedOn: asset.timestamp,
      workStarted: 0,
      workFinished: 0,
      canBeClaimedOn: 0,
      proposal: [],
      openedDisputes: [],
      closedDisputes: [],
      activity: [],
      commitmentFee:
        (BigInt(asset.prize) *
          BigInt(MISCELLANEOUS.LEADER_COMMITMENT_PERMYRIAD)) /
        BigInt(10000),
    };

    senderAccount.collabolancer.employer.ongoing.unshift(id);
    senderAccount.collabolancer.employer.log.unshift({
      timestamp: asset.timestamp,
      assetType: COLLABOLANCER_POST_PROJECT_ASSET_ID,
      value:
        BigInt(0) -
        BigInt(ProjectAsset.freezedFund) -
        BigInt(ProjectAsset.freezedFee),
      id: transaction.id,
    });
    senderAccount.collabolancer.employer.spent =
      BigInt(senderAccount.collabolancer.employer.spent) +
      BigInt(ProjectAsset.freezedFund) +
      BigInt(ProjectAsset.freezedFee);

    await reducerHandler.invoke("token:debit", {
      address: senderAddress,
      amount: ProjectAsset.freezedFund + ProjectAsset.freezedFee,
    });
    await stateStore.account.set(senderAccount.address, senderAccount);

    allProject.availableProject.unshift(id);
    await setAllProject(stateStore, allProject);
    await setProjectById(stateStore, id, ProjectAsset);
  }
}

module.exports = { PostProjectAsset };
