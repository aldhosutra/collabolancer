const { BaseAsset } = require("lisk-sdk");
const { COLLABOLANCER_CLAIM_PRIZE_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const { ClaimPrizeAssetSchema } = require("../schemas/asset");
const { asyncForEach, deflationaryMultiplier } = require("../utils/helper");
const {
  getProposalById,
  getProjectById,
  setProjectById,
  setTeamById,
  setProposalById,
} = require("../utils/chain_state");
const MISCELLANEOUS = require("../constants/miscellaneous");

class ClaimPrizeAsset extends BaseAsset {
  name = "claimPrize";
  id = COLLABOLANCER_CLAIM_PRIZE_ASSET_ID;
  schema = ClaimPrizeAssetSchema;

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

    const employer = await stateStore.account.get(project.employer);
    const proposal = await getProposalById(stateStore, project.winner);
    const leader = await stateStore.account.get(proposal.leader);

    let teamAccounts = [];
    asyncForEach(
      proposal.team.filter((el) => el !== null),
      async (item) => {
        const teamItem = await getTeamById(stateStore, item);
        teamAccounts.push(teamItem);
      }
    );

    if (
      ![
        STATUS.PROJECT.FINISHED,
        STATUS.PROJECT.REFUSED,
        STATUS.PROJECT.TERMINATED,
        STATUS.PROJECT.CANCELLED,
        STATUS.PROJECT.DISPUTE_CLOSED,
      ].includes(project.status)
    ) {
      throw new Error(
        `Project account status not in ${[
          STATUS.PROJECT.FINISHED,
          STATUS.PROJECT.REFUSED,
          STATUS.PROJECT.TERMINATED,
          STATUS.PROJECT.CANCELLED,
          STATUS.PROJECT.DISPUTE_CLOSED,
        ].toString()}`
      );
    }

    if (asset.timestamp < project.canBeClaimedOn) {
      throw new Error(`Cant claim prize yet`);
    }

    let deflation = await deflationaryMultiplier();

    const teamPaymentList = [];
    let noRejectedTeamLength = 0;

    asyncForEach(teamAccounts, async (item) => {
      const worker = await stateStore.account.get(item.worker);
      notRejectedTeamLength =
        item.status === STATUS.TEAM.REJECTED || item.guilty === true
          ? notRejectedTeamLength
          : notRejectedTeamLength + 1;
      teamPaymentList.push({
        address: worker.address,
        amount: BigInt(item.freezedFund),
        releasedFee: BigInt(item.freezedFee),
        cashback:
          BigInt(item.freezedFund) *
          (BigInt(MISCELLANEOUS.TEAM_CASHBACK_PERMYRIAD * deflation) /
            BigInt(100) /
            BigInt(1000)),
        status: item.status,
        guilty: item.guilty,
      });
    });

    asyncForEach(teamPaymentList, async (element) => {
      const worker = await stateStore.account.get(element.address);
      worker.collabolancer.worker.earning +=
        BigInt(element.amount) +
        BigInt(element.releasedFee) +
        BigInt(element.cashback);
      worker.collabolancer.worker.log.unshift({
        timestamp: asset.timestamp,
        assetType: COLLABOLANCER_CLAIM_PRIZE_ASSET_ID,
        value:
          BigInt(0) +
          BigInt(element.amount) +
          BigInt(element.releasedFee) +
          BigInt(element.cashback),
        id: transaction.id,
      });
      worker.collabolancer.worker.joined.splice(
        worker.collabolancer.worker.joined.indexOf(project.id),
        1
      );
      if (element.guilty === false) {
        worker.collabolancer.worker.contributorOf.unshift(project.id);
      } else {
        worker.collabolancer.worker.guilty.unshift(project.id);
      }
      await reducerHandler.invoke("token:credit", {
        address: worker.address,
        amount:
          BigInt(element.amount) +
          BigInt(element.releasedFee) +
          BigInt(element.cashback),
      });
      await stateStore.account.set(worker.address, worker);
    });

    const leaderEarning =
      BigInt(proposal.freezedFund) +
      BigInt(proposal.freezedFee) +
      BigInt(proposal.freezedFund) *
        (BigInt(MISCELLANEOUS.LEADER_CASHBACK_PERMYRIAD) / BigInt(10000)) *
        (BigInt(deflation) / BigInt(100)) *
        BigInt(notRejectedTeamLength);
    leader.collabolancer.worker.earning += BigInt(leaderEarning);
    leader.collabolancer.worker.log.unshift({
      timestamp: asset.timestamp,
      assetType: COLLABOLANCER_CLAIM_PRIZE_ASSET_ID,
      value: BigInt(0) + BigInt(leaderEarning),
      id: transaction.id,
    });
    leader.collabolancer.worker.joined.splice(
      leader.collabolancer.worker.joined.indexOf(project.id),
      1
    );

    if (proposal.guilty === true) {
      leader.collabolancer.worker.guilty.unshift(project.id);
    } else if (proposal.cancelled === true) {
      leader.collabolancer.worker.cancelled.unshift(project.id);
    } else {
      leader.collabolancer.worker.leaderOf.unshift(project.id);
    }

    await reducerHandler.invoke("token:credit", {
      address: leader.address,
      amount: leaderEarning,
    });
    await stateStore.account.set(leader.address, leader);

    employer.collabolancer.employer.spent =
      BigInt(employer.collabolancer.employer.spent) -
      BigInt(project.freezedFund) -
      BigInt(project.freezedFee);
    employer.collabolancer.employer.log.unshift({
      timestamp: asset.timestamp,
      assetType: COLLABOLANCER_CLAIM_PRIZE_ASSET_ID,
      value:
        BigInt(0) +
        BigInt(project.freezedFund) +
        BigInt(project.freezedFee) +
        (BigInt(project.freezedFund) *
          BigInt(MISCELLANEOUS.EMPLOYER_CASHBACK_PERMYRIAD)) /
          BigInt(10000),
      id: transaction.id,
    });
    if (project.terminated === true) {
      employer.collabolancer.employer.terminated.unshift(project.id);
    } else if (project.guilty === true) {
      employer.collabolancer.employer.guilty.unshift(project.id);
    } else {
      employer.collabolancer.employer.done.unshift(project.id);
    }
    employer.collabolancer.employer.ongoing.splice(
      employer.collabolancer.employer.ongoing.indexOf(project.id),
      1
    );

    await reducerHandler.invoke("token:credit", {
      address: employer.address,
      amount:
        BigInt(project.freezedFund) +
        BigInt(project.freezedFee) +
        (BigInt(project.freezedFund) *
          BigInt(MISCELLANEOUS.EMPLOYER_CASHBACK_PERMYRIAD)) /
          BigInt(10000),
    });
    await stateStore.account.set(employer.address, employer);

    project.status = STATUS.PROJECT.CLAIMED;
    project.cashback =
      ((BigInt(project.freezedFund) *
        BigInt(MISCELLANEOUS.EMPLOYER_CASHBACK_PERMYRIAD)) /
        BigInt(10000)) *
      (BigInt(deflation) / BigInt(100));
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_CLAIM_PRIZE_ASSET_ID,
    });
    await setProjectById(stateStore, project.id, project);

    proposal.status = STATUS.PROPOSAL.CLAIMED;
    proposal.cashback =
      ((BigInt(proposal.freezedFund) *
        BigInt(MISCELLANEOUS.LEADER_CASHBACK_PERMYRIAD)) /
        BigInt(10000)) *
      (BigInt(deflation) / BigInt(100)) *
      BigInt(notRejectedTeamLength);
    await setProposalById(stateStore, proposal.id, proposal);

    asyncForEach(teamAccounts, async (team) => {
      team.status = STATUS.TEAM.CLAIMED;
      team.cashback = BigInt(
        teamPaymentList.filter((el) => el.address === team.worker)[0].cashback
      );
      await setTeamById(stateStore, team.id, team);
    });
  }
}

module.exports = { ClaimPrizeAsset };
