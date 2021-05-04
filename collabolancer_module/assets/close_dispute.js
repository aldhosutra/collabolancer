const { BaseAsset } = require("lisk-sdk");
const { COLLABOLANCER_CLOSE_DISPUTE_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const ACCOUNT = require("../constants/account_type");
const { CloseDisputeAssetSchema } = require("../schemas/asset");
const { asyncForEach } = require("../utils/helper");
const {
  getProposalById,
  getProjectById,
  setProjectById,
  setTeamById,
  setProposalById,
  getDisputeById,
  getAllDispute,
  getTeamById,
  setDisputeById,
  setAllDispute,
} = require("../utils/chain_state");
const MISCELLANEOUS = require("../constants/miscellaneous");

class CloseDisputeAsset extends BaseAsset {
  name = "closeDispute";
  id = COLLABOLANCER_CLOSE_DISPUTE_ASSET_ID;
  schema = CloseDisputeAssetSchema;

  validate({ asset }) {
    if (!asset.disputeId || typeof asset.disputeId !== "string") {
      throw new Error(
        `Invalid "asset.disputeId" defined on transaction: Valid string is expected`
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
    const dispute = await getDisputeById(stateStore, asset.disputeId);

    if (!dispute) {
      throw new Error("Dispute data doesn't exists");
    }

    const allDispute = await getAllDispute(stateStore);

    if (!allDispute.availableDispute.includes(asset.disputeId)) {
      throw new Error(
        "Dispute Object public key not exist in state center available dispute registry"
      );
    }

    const project = await getProjectById(stateStore, dispute.project);
    const proposal = await getProposalById(stateStore, project.winner);

    let caseAccount;
    let targetFundAccount;
    if (dispute.caseType === ACCOUNT.PROPOSAL) {
      caseAccount = await getProposalById(stateStore, dispute.case);
      targetFundAccount = await getProjectById(
        stateStore,
        dispute.targetFundAccount
      );
    } else if (dispute.caseType === ACCOUNT.TEAM) {
      caseAccount = await getTeamById(stateStore, dispute.case);
      targetFundAccount = await getProposalById(
        stateStore,
        dispute.targetFundAccount
      );
    }

    const relatedAccount = {
      litigant: caseAccount,
      defendant: targetFundAccount,
    };

    const litigantVoters = [];
    const defendantVoters = [];
    asyncForEach(dispute.vote.litigant, async (el) => {
      const account = await stateStore.account.get(el);
      litigantVoters.push(account);
    });
    asyncForEach(dispute.vote.defendant, async (el) => {
      const account = await stateStore.account.get(el);
      defendantVoters.push(account);
    });

    if (asset.timestamp < dispute.timestamp + dispute.maxDays * 86400) {
      throw new Error("maxDays is not yet passed, can't close dispute yet");
    }

    let litigantScore = BigInt(0);
    let defendantScore = BigInt(0);

    litigantVoters.forEach(
      (item) => (litigantScore += BigInt(item.token.balance))
    );
    defendantVoters.forEach(
      (item) => (defendantVoters += BigInt(item.token.balance))
    );

    const disputeWinner =
      BigInt(litigantScore) > BigInt(defendantScore) ? "litigant" : "defendant";
    const disputeLoser =
      disputeWinner === "litigant" ? "defendant" : "litigant";
    const winner = relatedAccount[disputeWinner];
    const loser = relatedAccount[disputeLoser];

    dispute.score.litigant = litigantScore;
    dispute.score.defendant = defendantScore;
    dispute.winner = disputeWinner;

    const teamLength = proposal.team.filter((el) => el !== null).length;
    let teamBonus = BigInt(0);
    let solverBonus = BigInt(0);

    winner.freezedFee =
      BigInt(winner.freezedFee) +
      BigInt(dispute[disputeWinner + "FreezedFee"]) +
      (BigInt(dispute[disputeLoser + "FreezedFee"]) *
        BigInt(
          1000 - MISCELLANEOUS.DISPUTE_FREEZEDFEE_PINALTY_TOBE_SHARED_PERMYRIAD
        )) /
        BigInt(10000);
    if (dispute.disputeType === MISCELLANEOUS.DISPUTE_TYPE.LEADER_VS_EMPLOYER) {
      if (disputeWinner === "litigant") {
        winner.status = STATUS.PROPOSAL.DISPUTE_CLOSED;
        winner.freezedFund +=
          (BigInt(winner.potentialEarning) *
            BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000);
        asyncForEach(
          winner.team.filter((el) => el !== null),
          async (item) => {
            const team = await getTeamById(stateStore, item);
            team.status = team.oldStatus;
            team.oldStatus = null;
            if (team.oldStatus === STATUS.TEAM.SUBMITTED) {
              team.forceReject = false;
              team.freezedFund +=
                (BigInt(team.potentialEarning) *
                  BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
                BigInt(10000);
              await setTeamById(stateStore, team.id, team);
            } else if (team.oldStatus === STATUS.TEAM.REJECTED) {
              team.forceReject = false;
              winner.freezedFund +=
                (BigInt(team.potentialEarning) *
                  BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
                BigInt(10000);
              await setTeamById(stateStore, team.id, team);
            } else if (
              [STATUS.TEAM.SELECTED, STATUS.TEAM.REQUEST_REVISION].includes(
                team.oldStatus
              )
            ) {
              team.forceReject = false;
              loser.freezedFund +=
                (BigInt(team.potentialEarning) *
                  BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
                BigInt(10000);
            } else {
              throw new Error(
                "unkown team status for determining dispute prize distribution"
              );
            }
          }
        );
      } else {
        winner.freezedFund += dispute.freezedFund;
        dispute.freezedFund = BigInt(0);
        solverBonus +=
          (BigInt(dispute[disputeLoser + "FreezedFee"]) *
            BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000) /
          BigInt(dispute.vote[disputeWinner].length);
      }
    } else if (
      dispute.disputeType === MISCELLANEOUS.DISPUTE_TYPE.TEAM_VS_LEADER
    ) {
      if (disputeWinner === "litigant") {
        winner.status = STATUS.TEAM.DISPUTE_CLOSED;
        loser.status = STATUS.PROPOSAL.DISPUTE_CLOSED;
        teamBonus = loser.guilty
          ? 0
          : (BigInt(loser.potentialEarning) *
              BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
            BigInt(10000) /
            BigInt(teamLength);
        winner.freezedFund +=
          (BigInt(caseAccount.potentialEarning) *
            BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000);
        dispute.freezedFund -=
          (BigInt(caseAccount.potentialEarning) *
            BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000);
        asyncForEach(
          loser.team.filter((el) => el !== null),
          async (item) => {
            if (item === relatedAccount[disputeWinner].id) {
              winner.freezedFund += BigInt(teamBonus);
            } else {
              const team = await getTeamById(stateStore, item);
              team.freezedFund += BigInt(teamBonus);
              await setTeamById(stateStore, team.id, team);
            }
          }
        );
      } else {
        winner.status = STATUS.PROPOSAL.DISPUTE_CLOSED;
        loser.status = STATUS.TEAM.DISPUTE_CLOSED;
        loser.oldStatus = null;
        winner.freezedFund =
          BigInt(winner.freezedFund) +
          (BigInt(caseAccount.potentialEarning) *
            BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
            BigInt(10000) +
          (winner.guilty
            ? 0
            : (BigInt(winner.potentialEarning) *
                BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
              BigInt(10000));
        dispute.freezedFund -=
          (BigInt(caseAccount.potentialEarning) *
            BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000);
        solverBonus +=
          (BigInt(dispute[disputeLoser + "FreezedFee"]) *
            BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000) /
          BigInt(dispute.vote[disputeWinner].length);
      }
    }

    loser.guilty = true;
    dispute.status = STATUS.DISPUTE.CLOSED;

    await setDisputeById(stateStore, dispute.id, dispute);

    if (disputeWinner === "litigant") {
      if (dispute.caseType === ACCOUNT.PROPOSAL) {
        await setProposalById(stateStore, winner.id, winner);
        await setTeamById(stateStore, loser.id, loser);
      } else {
        await setTeamById(stateStore, winner.id, winner);
        await setProposalById(stateStore, loser.id, loser);
      }
    } else {
      if (dispute.targetFundAccountType === ACCOUNT.PROJECT) {
        await setProjectById(stateStore, winner.id, winner);
        await setProposalById(stateStore, loser.id, loser);
      } else {
        await setProposalById(stateStore, winner.id, winner);
        await setProjectById(stateStore, loser.id, loser);
      }
    }

    asyncForEach(dispute.vote[disputeWinner], async (el) => {
      const solver = await stateStore.account.get(el);
      const earning =
        BigInt(dispute.castVoteFee) +
        (BigInt(dispute.vote.litigant.length + dispute.vote.defendant.length) *
          BigInt(dispute.castVoteFee)) /
          BigInt(dispute.vote[disputeWinner].length) +
        BigInt(solverBonus);
      solver.collabolancer.solver.win++;
      solver.collabolancer.solver.log.unshift({
        timestamp: asset.timestamp,
        assetType: COLLABOLANCER_CLOSE_DISPUTE_ASSET_ID,
        value: BigInt(0) + BigInt(earning),
        id: transaction.id,
      });
      solver.collabolancer.solver.earning += BigInt(earning);
      await reducerHandler.invoke("token:credit", {
        address: solver.address,
        amount: earning,
      });
      await stateStore.account.set(solver.address, solver);
    });

    asyncForEach(dispute.vote[disputeLoser], async (el) => {
      const solver = await stateStore.account.get(el);
      solver.collabolancer.solver.lose++;
      await stateStore.account.set(solver.address, solver);
    });

    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_CLOSE_DISPUTE_ASSET_ID,
    });
    project.status =
      project.openedDisputes.length === 1
        ? STATUS.PROJECT.DISPUTE_CLOSED
        : STATUS.PROJECT.DISPUTED;
    project.openedDisputes.splice(
      project.openedDisputes.indexOf(dispute.id),
      1
    );
    project.closedDisputes.unshift(dispute.id);
    project.canBeClaimedOn =
      asset.timestamp +
      MISCELLANEOUS.FUND_FREEZED_PERIOD *
        MISCELLANEOUS.DISPUTE_CLOSED_CANBECLOSEDON_MULTIPLIER;
    await setProjectById(stateStore, project.id, project);

    allDispute.availableDispute.splice(
      allDispute.availableDispute.indexOf(dispute.id),
      1
    );
    allDispute.unavailableDispute.unshift(dispute.id);
    await setAllDispute(stateStore, allDispute);
  }
}

module.exports = { CloseDisputeAsset };
