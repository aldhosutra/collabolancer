const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const { COLLABOLANCER_POST_PROPOSAL_ASSET_ID } = require("../constants/id");
const MISCELLANEOUS = require("../constants/miscellaneous");
const STATUS = require("../constants/status");
const { PostProposalAssetSchema } = require("../schemas/asset");
const { asyncForEach } = require("../utils/helper");
const {
  generateID,
  getProjectById,
  setProjectById,
  getProposalById,
  setProposalById,
} = require("../utils/chain_state");

class PostProposalAsset extends BaseAsset {
  name = "postProposal";
  id = COLLABOLANCER_POST_PROPOSAL_ASSET_ID;
  schema = PostProposalAssetSchema;

  validate({ asset }) {
    if (!asset.projectId || typeof asset.projectId !== "string") {
      throw new Error(
        `Invalid "asset.projectId" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.pitching || typeof asset.pitching !== "string") {
      throw new Error(
        `Invalid "asset.pitching" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.term.roleList || !Array.isArray(asset.term.roleList)) {
      throw new Error(
        `Invalid "asset.term.roleList" defined on transaction: term.roleList must be Array`
      );
    }
    if (
      asset.term.roleList.length !== 0 &&
      (!asset.term.brief || typeof asset.term.brief !== "string")
    ) {
      throw new Error(
        `Invalid "asset.term.brief" defined on transaction: term.brief is required in collaboration mode, and must be string`
      );
    }
    if (
      asset.term.roleList.length !== 0 &&
      (typeof asset.term.maxTime !== "number" || asset.term.maxTime < 0)
    ) {
      throw new Error(
        `Invalid "asset.term.maxTime" defined on transaction: term.maxTime is required in collaboration mode, must be valid number and greater or equal to zero`
      );
    }
    if (
      asset.term.roleList.length !== 0 &&
      (typeof asset.term.maxRevision !== "number" || asset.term.maxRevision < 0)
    ) {
      throw new Error(
        `Invalid "asset.term.maxRevision" defined on transaction: term.maxRevision is required in collaboration mode, must be valid number and greater or equal to zero`
      );
    }
    if (
      asset.term.roleList.length !== 0 &&
      (!asset.term.distribution.mode ||
        typeof asset.term.distribution.mode !== "string" ||
        !Object.values(MISCELLANEOUS.DISTRIBUTION).includes(
          asset.term.distribution.mode
        ))
    ) {
      throw new Error(
        `Invalid "asset.term.distribution.mode" defined on transaction: term.distribution.mode is required in collaboration mode, must be string in ${Object.values(
          MISCELLANEOUS.DISTRIBUTION
        ).toString()}`
      );
    }
    if (
      asset.term.roleList.length !== 0 &&
      asset.term.distribution.mode ===
        MISCELLANEOUS.DISTRIBUTION.LEADER_FIRST &&
      (!asset.term.distribution.value ||
        typeof asset.term.distribution.value !== "number" ||
        asset.term.distribution.value < 0 ||
        asset.term.distribution.value > 100)
    ) {
      throw new Error(
        `Invalid "asset.term.distribution.value" defined on transaction: term.distribution.value is required in collaboration mode leader-first distribution, and must be valid number and beetween 0-100`
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
    const project = await getProjectById(stateStore, asset.projectId);
    const appliedProposalList = [];

    if (!project) {
      throw new Error("Project doesn't exist");
    }

    if (project.status !== STATUS.PROJECT.OPEN) {
      throw new Error("Project status is not open");
    }

    if (senderAccount.collabolancer.accountType !== ACCOUNT.WORKER) {
      throw new Error("Sender must be an Worker");
    }

    if (
      asset.term.roleList.length !== 0 &&
      (!asset.term.maxTime || typeof asset.term.maxTime !== "number") &&
      projectAccount.asset.maxTime - asset.term.maxTime <
        MISCELLANEOUS.MINIMAL_PROPOSAL_PROJECT_MAXTIME_DIFF
    ) {
      throw new Error(
        `Minimum Difference between Proposal maxTime and Project maxTime is: ${MISCELLANEOUS.MINIMAL_PROPOSAL_PROJECT_MAXTIME_DIFF}, can't be lower than that`
      );
    }

    asyncForEach(project.proposal, async (item) => {
      let appliedProposal = await getProposalById(item);
      appliedProposalList.push(appliedProposal);
    });

    if (
      appliedProposalList.map((item) => item.leader).includes(senderAddress)
    ) {
      throw new Error(
        "Sender must not have applied any proposal for this project"
      );
    }

    const id = generateID(senderAddress, transaction.nonce);

    const ProposalAsset = {
      id: id,
      project: asset.projectId,
      employer: project.employer,
      leader: senderAddress,
      term: {
        commitmentFee: BigInt(0),
        roleList: asset.term.roleList,
        brief:
          typeof asset.term.brief !== "undefined" &&
          asset.term.roleList.length !== 0
            ? asset.term.brief
            : "",
        maxTime:
          typeof asset.term.maxTime !== "undefined" &&
          asset.term.roleList.length !== 0
            ? asset.term.maxTime
            : -1,
        maxRevision:
          typeof asset.term.maxRevision !== "undefined" &&
          asset.term.roleList.length !== 0
            ? asset.term.maxRevision
            : -1,
        distribution: {
          mode:
            typeof asset.term.distribution.mode !== "undefined" &&
            asset.term.roleList.length !== 0
              ? asset.term.distribution.mode
              : MISCELLANEOUS.DISTRIBUTION.ALL_EQUAL,
          value:
            typeof asset.term.distribution.value !== "undefined" &&
            asset.term.roleList.length !== 0
              ? asset.term.distribution.value
              : 100,
        },
      },
      status: STATUS.PROPOSAL.APPLIED,
      guilty: false,
      cancelled: false,
      potentialEarning: BigInt(0),
      freezedFund: BigInt(0),
      freezedFee: BigInt(0),
      cashback: BigInt(0),
      pitching: asset.pitching,
      lastSubmitted: 0,
      team: asset.term.roleList.map(() => null),
    };
    const allEqualBoolean =
      ProposalAsset.term.roleList.length !== 0 &&
      ProposalAsset.term.distribution.mode ===
        MISCELLANEOUS.DISTRIBUTION.ALL_EQUAL;
    const leaderFirstBoolean =
      ProposalAsset.term.roleList.length !== 0 &&
      ProposalAsset.term.distribution.mode ===
        MISCELLANEOUS.DISTRIBUTION.LEADER_FIRST;

    if (allEqualBoolean) {
      ProposalAsset.term.distribution.value =
        100 / (ProposalAsset.term.roleList.length + 1);
    }

    const leaderPortion =
      (BigInt(project.prize) * BigInt(proposalAsset.distribution.value)) /
      BigInt(100);
    ProposalAsset.potentialEarning = BigInt(leaderPortion);

    if (allEqualBoolean) {
      ProposalAsset.term.commitmentFee =
        (BigInt(leaderPortion) *
          BigInt(MISCELLANEOUS.TEAM_COMMITMENT_PERMYRIAD)) /
        BigInt(10000);
    } else if (leaderFirstBoolean) {
      ProposalAsset.term.commitmentFee =
        (((BigInt(project.prize) - BigInt(leaderPortion)) /
          BigInt(proposalAsset.term.roleList.length)) *
          BigInt(MISCELLANEOUS.TEAM_COMMITMENT_PERMYRIAD)) /
        BigInt(10000);
    }

    project.freezedFee += BigInt(project.commitmentFee);
    project.proposal.unshift(id);
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_POST_PROPOSAL_ASSET_ID,
    });

    senderAccount.collabolancer.worker.joined.unshift(asset.projectId);
    senderAccount.collabolancer.worker.log.unshift({
      timestamp: asset.timestamp,
      assetType: COLLABOLANCER_POST_PROPOSAL_ASSET_ID,
      value: BigInt(0) - BigInt(project.commitmentFee),
      id: transaction.id,
    });
    senderAccount.collabolancer.worker.earning -= BigInt(project.commitmentFee);

    await reducerHandler.invoke("token:debit", {
      address: senderAddress,
      amount: project.commitmentFee,
    });
    await stateStore.account.set(senderAccount.address, senderAccount);

    await setProjectById(stateStore, project.id, project);
    await setProposalById(stateStore, id, ProposalAsset);
  }
}

module.exports = { PostProposalAsset };
