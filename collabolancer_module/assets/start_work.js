const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const { COLLABOLANCER_START_WORK_ASSET_ID } = require("../constants/id");
const MISCELLANEOUS = require("../constants/miscellaneous");
const STATUS = require("../constants/status");
const { StartWorkAssetSchema } = require("../schemas/asset");
const { asyncForEach } = require("../utils/helper");
const {
  getProjectById,
  setProjectById,
  getProposalById,
  setProposalById,
  getTeamById,
  setTeamById,
  getAllProject,
  setAllProject,
} = require("../utils/chain_state");

class StartWorkAsset extends BaseAsset {
  name = "startWork";
  id = COLLABOLANCER_START_WORK_ASSET_ID;
  schema = StartWorkAssetSchema;

  validate({ asset }) {
    if (!asset.projectId || typeof asset.projectId !== "string") {
      throw new Error(
        `Invalid "asset.projectId" defined on transaction: Valid string is expected`
      );
    }
    if (
      !asset.selectedProposalId ||
      typeof asset.selectedProposalId !== "string"
    ) {
      throw new Error(
        `Invalid "asset.selectedProposalId" defined on transaction: Valid string is expected`
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
    const project = await getProjectById(stateStore, asset.projectId);

    if (!project) {
      throw new Error("Project doesn't exist");
    }

    const proposal = await getProposalById(
      stateStore,
      asset.selectedProposalId
    );

    if (!proposal) {
      throw new Error("Proposal doesn't exist");
    }

    const nonSelectedProposal = [];
    asyncForEach(
      project.proposal.filter((el) => el !== asset.selectedProposalId),
      async (item) => {
        let proposal = await getProposalById(item);
        nonSelectedProposal.push(appliedTeam);
      }
    );

    const teamAccount = [];
    asyncForEach(
      nonSelectedProposal.team.filter((el) => el !== null),
      async (item) => {
        let team = await getTeamById(item);
        teamAccount.push(team);
      }
    );

    let pinaltyPool = BigInt(0);
    let totalFeeReleased = BigInt(0);
    const commitmentFeeReleaseList = [];
    asyncForEach(nonSelectedProposal, async (element) => {
      pinaltyPool =
        BigInt(pinaltyPool) +
        (BigInt(project.commitmentFee) *
          BigInt(MISCELLANEOUS.LEADER_NOTSELECTED_PINALTY_PERMYRIAD)) /
          BigInt(10000);
      totalFeeReleased += BigInt(project.commitmentFee);
      commitmentFeeReleaseList.push({
        address: element.leader,
        released:
          BigInt(project.commitmentFee) -
          (BigInt(project.commitmentFee) *
            BigInt(MISCELLANEOUS.LEADER_NOTSELECTED_PINALTY_PERMYRIAD)) /
            BigInt(10000),
      });
      await asyncForEach(
        element.team.filter((el) => el !== null),
        async (item) => {
          let workerTeam = await getTeamById(stateStore, item);
          commitmentFeeReleaseList.push({
            address: workerTeam.worker,
            released: BigInt(element.term.commitmentFee),
          });
        }
      );
    });

    if (senderAccount.collabolancer.accountType !== ACCOUNT.EMPLOYER) {
      throw new Error("Sender must be an Employer");
    }

    if (project.employer !== senderAddress) {
      throw new Error("Sender is not owner of the project");
    }

    if (!project.proposal.includes(asset.selectedProposalId)) {
      throw new Error(
        "asset.selectedProposalId is not present inside project applied proposal"
      );
    }

    asyncForEach(nonSelectedProposal, async (element) => {
      const index = commitmentFeeReleaseList
        .map((el) => el.address)
        .indexOf(element.leader);
      let elementProposal = element;
      elementProposal.status = STATUS.PROPOSAL.NOT_SELECTED;
      elementProposal.freezedFee =
        BigInt(0) + BigInt(commitmentFeeReleaseList[index].released);
      await setProposalById(stateStore, element.id, elementProposal);
    });

    asyncForEach(teamAccount, async (element) => {
      const index = commitmentFeeReleaseList
        .map((el) => el.address)
        .indexOf(element.worker);
      let elementTeam = element;
      elementTeam.status = STATUS.TEAM.NOT_SELECTED;
      elementTeam.freezedFee =
        BigInt(0) + BigInt(commitmentFeeReleaseList[index].released);
      await setTeamById(stateStore, element.id, elementTeam);
    });

    asyncForEach(commitmentFeeReleaseList, async (element) => {
      const releasedAccount = await stateStore.account.get(element.address);
      const joinedIndex = releasedAccount.collabolancer.worker.joined.indexOf(
        project.id
      );
      if (joinedIndex > -1) {
        releasedAccount.collabolancer.worker.joined.splice(joinedIndex, 1);
      }
      releasedAccount.collabolancer.worker.log.unshift({
        timestamp: asset.timestamp,
        assetType: COLLABOLANCER_START_WORK_ASSET_ID,
        value: BigInt(0) + BigInt(element.released),
        id: transaction.id,
      });
      releasedAccount.collabolancer.worker.earning += BigInt(element.released);
      await stateStore.account.set(element.address, releasedAccount);
      await reducerHandler.invoke("token:credit", {
        address: element.address,
        amount: element.released,
      });
    });

    project.winner = asset.selectedProposalId;
    project.workStarted = asset.timestamp;
    project.status = STATUS.PROJECT.WORKING;
    project.freezedFee -= BigInt(totalFeeReleased);
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_START_WORK_ASSET_ID,
    });

    const nullTeamCount = proposal.team.filter((el) => el === null).length;
    const teamLength = proposal.team.filter((el) => el !== null).length;
    const divider = teamLength + 1;

    let noTeamAppliedBonus = BigInt(0);
    if (teamLength === 0) {
      noTeamAppliedBonus =
        BigInt(nullTeamCount) *
        ((BigInt(proposal.term.commitmentFee) * BigInt(10000)) /
          BigInt(MISCELLANEOUS.TEAM_COMMITMENT_PERMYRIAD));
    }

    let nullTeamBonus = BigInt(0);
    if (
      proposal.term.distribution.mode ===
      MISCELLANEOUS.DISTRIBUTION.LEADER_FIRST
    ) {
      nullTeamBonus =
        BigInt(nullTeamCount) *
        ((BigInt(proposal.term.commitmentFee) * BigInt(10000)) /
          BigInt(MISCELLANEOUS.TEAM_COMMITMENT_PERMYRIAD));
    } else if (
      proposal.term.distribution.mode === MISCELLANEOUS.DISTRIBUTION.ALL_EQUAL
    ) {
      nullTeamBonus =
        (BigInt(nullTeamCount) *
          ((BigInt(proposal.term.commitmentFee) * BigInt(10000)) /
            BigInt(MISCELLANEOUS.TEAM_COMMITMENT_PERMYRIAD))) /
        BigInt(divider);
      noTeamAppliedBonus += BigInt(nullTeamBonus);
    }

    proposal.status = STATUS.PROPOSAL.SELECTED;
    proposal.potentialEarning += BigInt(noTeamAppliedBonus);
    proposal.freezedFee += BigInt(pinaltyPool) / BigInt(divider);

    allProject.unavailableProject.unshift(project.id);
    allProject.availableProject.splice(
      allProject.availableProject.indexOf(project.id),
      1
    );
    await setAllProject(stateStore, allProject);

    asyncForEach(
      proposal.team.filter((el) => el !== null),
      async (element) => {
        const selectedTeam = await getTeamById(stateStore, element);
        selectedTeam.status = STATUS.TEAM.SELECTED;
        selectedTeam.potentialEarning += nullTeamBonus;
        selectedTeam.freezedFee += BigInt(pinaltyPool) / BigInt(divider);
        await setTeamById(stateStore, element, selectedTeam);
      }
    );

    await setProjectById(stateStore, project.id, project);
    await setProposalById(stateStore, proposal.id, proposal);
  }
}

module.exports = { StartWorkAsset };
