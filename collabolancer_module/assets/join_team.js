const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const { COLLABOLANCER_JOIN_TEAM_ASSET_ID } = require("../constants/id");
const MISCELLANEOUS = require("../constants/miscellaneous");
const STATUS = require("../constants/status");
const { JoinTeamAssetSchema } = require("../schemas/asset");
const { asyncForEach } = require("../utils/helper");
const {
  generateID,
  getProjectById,
  setProjectById,
  getProposalById,
  setProposalById,
  getTeamById,
  setTeamById,
} = require("../utils/chain_state");

class JoinTeamAsset extends BaseAsset {
  name = "joinTeam";
  id = COLLABOLANCER_JOIN_TEAM_ASSET_ID;
  schema = JoinTeamAssetSchema;

  validate({ asset }) {
    if (!asset.proposalId || typeof asset.proposalId !== "string") {
      throw new Error(
        `Invalid "asset.proposalId" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.role || typeof asset.role !== "number") {
      throw new Error(
        `Invalid "asset.role" defined on transaction: Valid number is expected`
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
    const proposal = await getProposalById(stateStore, asset.proposalId);

    if (!proposal) {
      throw new Error("Proposal doesn't exist");
    }

    const project = await getProjectById(stateStore, proposal.project);

    if (project.status !== STATUS.PROJECT.OPEN) {
      throw new Error("Project status is not open");
    }

    if (senderAccount.collabolancer.accountType !== ACCOUNT.WORKER) {
      throw new Error("Sender must be an Worker");
    }

    const appliedTeamList = [];

    asyncForEach(
      proposal.team.filter((el) => el !== null),
      async (item) => {
        let appliedTeam = await getTeamById(item);
        appliedTeamList.push(appliedTeam);
      }
    );

    if (appliedTeamList.map((item) => item.worker).includes(senderAddress)) {
      throw new Error(
        "Sender must not have applied any team member for this proposal"
      );
    }

    if (proposal.leader === senderAddress) {
      throw new Error("Leader can't apply as team member");
    }

    if (proposal.status !== STATUS.PROPOSAL.APPLIED) {
      throw new Error(
        `Proposal Status is not ${STATUS.PROPOSAL.APPLIED}, can't join team`
      );
    }

    if (typeof proposal.team[asset.role] === "undefined") {
      throw new Error(`Role index out of range`);
    }

    if (proposal.team[asset.role] !== null) {
      throw new Error(`Role slot is already assigned`);
    }

    const id = generateID(senderAddress, transaction.nonce);

    const TeamAsset = {
      id: id,
      role: proposal.term.roleList[asset.role],
      leader: proposal.leader,
      proposal: proposal.id,
      project: proposal.project,
      worker: senderAddress,
      freezedFund: BigInt(0),
      freezedFee: BigInt(0),
      cashback: BigInt(0),
      potentialEarning:
        (BigInt(proposal.term.commitmentFee) * BigInt(10000)) /
        BigInt(MISCELLANEOUS.TEAM_COMMITMENT_PERMYRIAD),
      contribution: [],
      statusNote: [],
      status: STATUS.TEAM.APPLIED,
      oldStatus: null,
      forceReject: false,
      forceCancel: false,
      guilty: false,
      lastSubmitted: 0,
    };

    proposal.freezedFee += BigInt(proposal.term.commitmentFee);
    proposal.team[asset.role] = id;

    senderAccount.collabolancer.worker.joined.unshift(proposal.project);
    senderAccount.collabolancer.worker.log.unshift({
      timestamp: asset.timestamp,
      assetType: COLLABOLANCER_JOIN_TEAM_ASSET_ID,
      value: BigInt(0) - BigInt(proposal.term.commitmentFee),
      id: transaction.id,
    });
    senderAccount.collabolancer.worker.earning -= BigInt(
      proposal.term.commitmentFee
    );

    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_JOIN_TEAM_ASSET_ID,
    });

    await reducerHandler.invoke("token:debit", {
      address: senderAddress,
      amount: proposal.term.commitmentFee,
    });
    await stateStore.account.set(senderAccount.address, senderAccount);

    await setProjectById(stateStore, proposal.project, project);
    await setProposalById(stateStore, proposal.id, proposal);
    await setTeamById(stateStore, id, TeamAsset);
  }
}

module.exports = { JoinTeamAsset };
