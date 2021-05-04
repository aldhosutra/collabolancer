const { BaseAsset } = require("lisk-sdk");
const { COLLABOLANCER_CANCEL_PROJECT_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const ACCOUNT = require("../constants/account_type");
const { CancelProjectAssetSchema } = require("../schemas/asset");
const { asyncForEach } = require("../utils/helper");
const {
  getProposalById,
  getProjectById,
  setProjectById,
  setTeamById,
  setProposalById,
} = require("../utils/chain_state");

class CancelProjectAsset extends BaseAsset {
  name = "cancelProject";
  id = COLLABOLANCER_CANCEL_PROJECT_ASSET_ID;
  schema = CancelProjectAssetSchema;

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

    let teamAccounts = [];
    asyncForEach(
      proposal.team.filter((el) => el !== null),
      async (item) => {
        const teamItem = await getTeamById(stateStore, item);
        teamAccounts.push(teamItem);
      }
    );

    if (senderAccount.collabolancer.accountType !== ACCOUNT.EMPLOYER) {
      throw new Error(`Sender is not employer`);
    }

    if (
      ![STATUS.PROJECT.WORKING, STATUS.PROJECT.REQUEST_REVISION].includes(
        project.status
      )
    ) {
      throw new Error(
        `Project account status not in ${[
          STATUS.PROJECT.WORKING,
          STATUS.PROJECT.REQUEST_REVISION,
        ].toString()}`
      );
    }

    if (project.employer !== senderAddress) {
      throw new Error(`Sender is not employer of project`);
    }

    if (
      ![STATUS.PROPOSAL.SELECTED, STATUS.PROPOSAL.REQUEST_REVISION].includes(
        proposal.status
      )
    ) {
      throw new Error(
        `proposal status not in ${[
          STATUS.PROPOSAL.SELECTED,
          STATUS.PROPOSAL.REQUEST_REVISION,
        ].toString()}`
      );
    }

    if (asset.timestamp < project.workStarted + project.maxTime * 86400) {
      throw new Error(
        `maxTime is not yet passed, let's wait for employer to mark this project finished`
      );
    }

    proposal.cancelled = true;

    project.status = STATUS.PROJECT.CANCELLED;
    project.workFinished = asset.timestamp;
    project.canBeClaimedOn = asset.timestamp;
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_CANCEL_PROJECT_ASSET_ID,
    });

    asyncForEach(teamAccounts, async (team) => {
      if (team.status === STATUS.TEAM.SUBMITTED) {
        team.forceCancel = true;
        project.freezedFund += BigInt(team.potentialEarning);
        team.freezedFund -= BigInt(team.potentialEarning);
      } else {
        proposal.freezedFee -= BigInt(proposal.term.commitmentFee);
        team.freezedFee += BigInt(proposal.term.commitmentFee);
      }
      await setTeamById(stateStore, team.id, team);
    });

    await setProposalById(stateStore, proposal.id, proposal);
    await setProjectById(stateStore, project.id, project);
  }
}

module.exports = { CancelProjectAsset };
