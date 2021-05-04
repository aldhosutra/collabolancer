const { BaseAsset } = require("lisk-sdk");
const { COLLABOLANCER_TERMINATE_PROJECT_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const ACCOUNT = require("../constants/account_type");
const MISCELLANEOUS = require("../constants/miscellaneous");
const { FinishProjectAssetSchema } = require("../schemas/asset");
const {
  getProposalById,
  getProjectById,
  setProjectById,
} = require("../utils/chain_state");

class TerminateProjectAsset extends BaseAsset {
  name = "terminateProject";
  id = COLLABOLANCER_TERMINATE_PROJECT_ASSET_ID;
  schema = FinishProjectAssetSchema;

  validate({ asset }) {
    if (!asset.projectId || typeof asset.projectId !== "string") {
      throw new Error(
        `Invalid "asset.projectId" defined on transaction: Valid string is expected`
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

    if (!project) {
      throw new Error("Project data doesn't exists");
    }

    const proposal = await getProposalById(stateStore, project.winner);

    if (senderAccount.collabolancer.accountType !== ACCOUNT.WORKER) {
      throw new Error(`Sender is not worker`);
    }

    if (project.status !== STATUS.PROJECT.SUBMITTED) {
      throw new Error(
        `Project account status is not ${STATUS.PROJECT.SUBMITTED}, therefore you can't terminate this work`
      );
    }

    if (proposal.leader !== senderAddress) {
      throw new Error(`Sender is not leader of project`);
    }

    if (proposal.status !== STATUS.PROPOSAL.SUBMITTED) {
      throw new Error(
        `proposal status is not ${STATUS.PROJECT.SUBMITTED}, therefore cant terminate project`
      );
    }

    if (
      asset.timestamp <
      proposal.lastSubmitted + MISCELLANEOUS.SUBMIT_TO_TERMINATE_MIN_PERIOD
    ) {
      throw new Error(
        `minimal period to terminate from last time work submitted, is not yet passed, therefore, termination is not available`
      );
    }

    if (asset.timestamp < project.workStarted + project.maxTime * 86400) {
      throw new Error(
        `maxTime is not yet passed, let's wait for employer to mark this project finished`
      );
    }

    project.status = STATUS.PROJECT.TERMINATED;
    project.terminated = true;
    project.canBeClaimedOn =
      asset.timestamp + MISCELLANEOUS.FUND_FREEZED_PERIOD;
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_TERMINATE_PROJECT_ASSET_ID,
    });

    await setProjectById(stateStore, project.id, project);
  }
}

module.exports = { TerminateProjectAsset };
