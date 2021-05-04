const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const {
  COLLABOLANCER_SUBMIT_CONTRIBUTION_ASSET_ID,
} = require("../constants/id");
const STATUS = require("../constants/status");
const { SubmitContributionAssetSchema } = require("../schemas/asset");
const {
  getTeamById,
  getProposalById,
  getProjectById,
  generateID,
  setProposalById,
  setContributionById,
  setTeamById,
  setProjectById,
  setAllFile,
  getAllFile,
} = require("../utils/chain_state");

class SubmitContributionAsset extends BaseAsset {
  name = "submitContribution";
  id = COLLABOLANCER_SUBMIT_CONTRIBUTION_ASSET_ID;
  schema = SubmitContributionAssetSchema;

  validate({ asset }) {
    if (!asset.teamId || typeof asset.teamId !== "string") {
      throw new Error(
        `Invalid "asset.teamId" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.extension || typeof asset.extension !== "string") {
      throw new Error(
        `Invalid "asset.extension" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.mime || typeof asset.mime !== "string") {
      throw new Error(
        `Invalid "asset.mime" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.name || typeof asset.name !== "string") {
      throw new Error(
        `Invalid "asset.name" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.data || typeof asset.data !== "string") {
      throw new Error(
        `Invalid "asset.data" defined on transaction: Valid string is expected`
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
    const team = await getTeamById(stateStore, asset.teamId);

    if (!team) {
      throw new Error("Team data doesn't exists");
    }

    const proposal = await getProposalById(stateStore, team.proposal);
    const project = await getProjectById(stateStore, team.project);
    const allFile = await getAllFile(stateStore);

    if (
      ![STATUS.TEAM.SELECTED, STATUS.TEAM.REQUEST_REVISION].includes(
        team.status
      )
    ) {
      throw new Error(
        `Team account status is not ${STATUS.TEAM.SELECTED} or ${STATUS.TEAM.REQUEST_REVISION}, therefore you can't submit contribution`
      );
    }

    if (
      proposal.term.roleList.length > 0 &&
      proposal.term.maxRevision !== -1 &&
      team.contribution.length >= proposal.term.maxRevision
    ) {
      throw new Error(
        `Exceed Max Revision Limit, You can't submit contribution anymore`
      );
    }

    if (senderAccount.collabolancer.accountType !== ACCOUNT.WORKER) {
      throw new Error("Sender must be an Worker");
    }

    if (team.worker !== senderAddress) {
      throw new Error("You are not the owner of this team data");
    }

    if (asset.timestamp > project.workStarted + project.maxTime * 86400) {
      throw new Error(
        "maxTime is passed, you can't submit contribution anymore"
      );
    }

    const id = generateID(senderAddress, transaction.nonce);

    const ContributionAsset = {
      id: id,
      owner: senderAddress,
      project: team.project,
      proposal: team.proposal,
      team: team.id,
      time: asset.timestamp,
      extension: asset.extension,
      mime: asset.mime,
      filename: asset.name,
      data: asset.data,
    };

    proposal.freezedFee -= BigInt(proposal.commitmentFee);

    team.status = STATUS.TEAM.SUBMITTED;
    team.lastSubmitted = asset.timestamp;
    team.contribution.unshift(id);
    team.freezedFund += BigInt(team.potentialEarning);
    team.freezedFee += BigInt(proposal.commitmentFee);

    project.freezedFund -= BigInt(team.potentialEarning);
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_SUBMIT_CONTRIBUTION_ASSET_ID,
    });

    senderAccount.collabolancer.worker.file.unshift(id);
    allFile.push(id);

    await setProposalById(stateStore, proposal.id, proposal);
    await setContributionById(stateStore, id, ContributionAsset);
    await setTeamById(stateStore, team.id, team);
    await setProjectById(stateStore, project.id, project);
    await setAllFile(stateStore, allFile);
    await stateStore.account.set(senderAccount.address, senderAccount);
  }
}

module.exports = { SubmitContributionAsset };
