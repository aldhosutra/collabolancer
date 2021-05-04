const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const {
  COLLABOLANCER_REJECT_CONTRIBUTION_ASSET_ID,
} = require("../constants/id");
const STATUS = require("../constants/status");
const { RejectContributionAssetSchema } = require("../schemas/asset");
const {
  getTeamById,
  getProposalById,
  getProjectById,
  setProposalById,
  setTeamById,
  setProjectById,
  getContributionById,
} = require("../utils/chain_state");

class RejectContributionAsset extends BaseAsset {
  name = "rejectContribution";
  id = COLLABOLANCER_REJECT_CONTRIBUTION_ASSET_ID;
  schema = RejectContributionAssetSchema;

  validate({ asset }) {
    if (!asset.contributionId || typeof asset.contributionId !== "string") {
      throw new Error(
        `Invalid "asset.contributionId" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.reason || typeof asset.reason !== "string") {
      throw new Error(
        `Invalid "asset.reason" defined on transaction: Valid string is expected`
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
    const contribution = await getContributionById(
      stateStore,
      asset.contributionId
    );

    if (!contribution) {
      throw new Error("Contribution data doesn't exists");
    }

    const team = await getTeamById(stateStore, contribution.team);
    const proposal = await getProposalById(stateStore, contribution.proposal);
    const project = await getProjectById(stateStore, contribution.project);

    if (senderAccount.collabolancer.accountType !== ACCOUNT.WORKER) {
      throw new Error("Sender must be an Worker");
    }

    if (proposal.leader !== senderAddress) {
      throw new Error(
        "You are not the leader of this related proposal contribution"
      );
    }

    if (team.status !== STATUS.TEAM.SUBMITTED) {
      throw new Error(`contribution status is not yet submitted`);
    }

    if (team.statusNote.length !== team.contribution.length - 1) {
      throw new Error(
        "statusNote length and contribution length are not match"
      );
    }

    let reason;
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_REJECT_CONTRIBUTION_ASSET_ID,
    });

    if (
      (proposal.term.roleList.length > 0 &&
        proposal.term.maxRevision !== -1 &&
        team.contribution.length >= proposal.term.maxRevision) ||
      asset.timestamp > project.workStarted + project.maxTime * 86400
    ) {
      team.status = STATUS.TEAM.REJECTED;
      let reasonPrefix =
        asset.timestamp > project.workStarted + project.maxTime * 86400
          ? "TIMEOUT REJECTION"
          : "MAX REVISION EXCEEDED";
      reason =
        reasonPrefix +
        ", your are out of this collaboration, your prize will be given to leader. Leader note: " +
        this.asset.reason;
      proposal.freezedFund += BigInt(team.potentialEarning);
    } else {
      team.status = STATUS.TEAM.REQUEST_REVISION;
      reason = asset.reason;
      project.freezedFund += BigInt(team.potentialEarning);
    }

    proposal.freezedFee += BigInt(proposal.term.commitmentFee);
    team.freezedFund -= BigInt(team.potentialEarning);
    team.freezedFee -= BigInt(proposal.term.commitmentFee);
    team.statusNote.unshift({
      time: asset.timestamp,
      status: team.status,
      contribution: asset.contributionId,
      reason: reason,
    });

    await setProposalById(stateStore, proposal.id, proposal);
    await setProjectById(stateStore, project.id, project);
    await setTeamById(stateStore, team.id, team);
  }
}

module.exports = { RejectContributionAsset };
