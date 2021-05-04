const { BaseAsset } = require("lisk-sdk");
const { COLLABOLANCER_FINISH_PROJECT_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const MISCELLANEOUS = require("../constants/miscellaneous");
const { FinishProjectAssetSchema } = require("../schemas/asset");
const { asyncForEach } = require("../utils/helper");
const {
  getTeamById,
  getProposalById,
  getProjectById,
  setProjectById,
} = require("../utils/chain_state");

class FinishProjectAsset extends BaseAsset {
  name = "finishProject";
  id = COLLABOLANCER_FINISH_PROJECT_ASSET_ID;
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

    if (
      ![STATUS.PROJECT.SUBMITTED, STATUS.PROJECT.REJECTED].includes(
        project.status
      )
    ) {
      throw new Error(
        `Project account status is not in ${[
          STATUS.PROJECT.SUBMITTED,
          STATUS.PROJECT.REJECTED,
        ].toString()}, therefore you can't finish this work`
      );
    }

    if (
      project.status === STATUS.PROJECT.SUBMITTED &&
      project.employer !== senderAddress
    ) {
      throw new Error("You are not the employer of this project");
    }

    if (
      project.status === STATUS.PROJECT.REJECTED &&
      ![project.employer, project.leader]
        .concat(teamAccounts.map((item) => item.worker))
        .includes(senderAddress)
    ) {
      throw new Error(
        `either project owner, selected proposal leader, or its team member can finish rejected project`
      );
    }

    if (
      asset.timestamp < project.workStarted + proposal.term.maxTime * 86400 &&
      project.status === STATUS.PROJECT.SUBMITTED &&
      teamAccounts.map((el) => el.status).includes(STATUS.TEAM.REQUEST_REVISION)
    ) {
      throw new Error(
        `proposal maxTime is not yet passed, and one or more team is still working on revision, please wait for them to finish their revision, they still have time`
      );
    }

    if (project.status === STATUS.PROJECT.SUBMITTED) {
      project.status = STATUS.PROJECT.FINISHED;
      project.statusNote.unshift({
        time: asset.timestamp,
        status: project.status,
        submission: project.submission[0],
        reason: "accepted",
      });
    } else if (project.status === STATUS.PROJECT.REJECTED) {
      project.status = STATUS.PROJECT.REFUSED;
    }

    project.workFinished = asset.timestamp;
    project.canBeClaimedOn =
      asset.timestamp + MISCELLANEOUS.FUND_FREEZED_PERIOD;
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_FINISH_PROJECT_ASSET_ID,
    });

    await setProjectById(stateStore, project.id, project);
  }
}

module.exports = { FinishProjectAsset };
