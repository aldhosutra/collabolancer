const { BaseAsset } = require("lisk-sdk");
const { COLLABOLANCER_OPEN_DISPUTE_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const ACCOUNT = require("../constants/account_type");
const { OpenDisputeAssetSchema } = require("../schemas/asset");
const MISCELLANEOUS = require("../constants/miscellaneous");
const {
  getProposalById,
  getProjectById,
  setProjectById,
  setTeamById,
  setProposalById,
  getTeamById,
  generateID,
  getAllDispute,
  setAllDispute,
  setDisputeById,
} = require("../utils/chain_state");

class OpenDisputeAsset extends BaseAsset {
  name = "openDispute";
  id = COLLABOLANCER_OPEN_DISPUTE_ASSET_ID;
  schema = OpenDisputeAssetSchema;

  validate({ asset }) {
    if (!asset.caseId || typeof asset.caseId !== "string") {
      throw new Error(
        `Invalid "asset.caseId" defined on transaction: Valid string is expected`
      );
    }
    if (
      !asset.caseType ||
      typeof asset.caseType !== "string" ||
      ![ACCOUNT.PROPOSAL, ACCOUNT.TEAM].includes(asset.caseType)
    ) {
      throw new Error(
        `Invalid "asset.caseType" defined on transaction: A string value with value ${[
          ACCOUNT.PROPOSAL,
          ACCOUNT.TEAM,
        ].toString()} is expected`
      );
    }
    if (!asset.projectId || typeof asset.projectId !== "string") {
      throw new Error(
        `Invalid "asset.projectId" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.suit || typeof asset.suit !== "string") {
      throw new Error(
        `Invalid "asset.suit" defined on transaction: Valid string is expected`
      );
    }
    if (!asset.maxDays || typeof asset.maxDays !== "number") {
      throw new Error(
        `Invalid "asset.maxDays" defined on transaction: Valid number is expected`
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

    if (
      ![
        STATUS.PROJECT.FINISHED,
        STATUS.PROJECT.REFUSED,
        STATUS.PROJECT.TERMINATED,
        STATUS.PROJECT.DISPUTED,
        STATUS.PROJECT.DISPUTE_CLOSED,
      ].includes(project.status)
    ) {
      throw new Error(
        `Project account status is not in ${[
          STATUS.PROJECT.FINISHED,
          STATUS.PROJECT.REFUSED,
          STATUS.PROJECT.TERMINATED,
          STATUS.PROJECT.DISPUTED,
          STATUS.PROJECT.DISPUTE_CLOSED,
        ].toString()}, therefore you can't open a dispute`
      );
    }

    if (asset.timestamp > project.canBeClaimedOn) {
      throw new Error(
        "Fund Freezed Period is over, can't open dispute anymore"
      );
    }

    if (
      asset.maxDays >
      Math.max(MISCELLANEOUS.DISPUTE_MAXIMAL_OPEN_PERIOD, project.maxTime)
    ) {
      throw new Error(
        `maxDays must be valid number and not greater than ${Math.max(
          MISCELLANEOUS.DISPUTE_MAXIMAL_OPEN_PERIOD,
          project.maxTime
        )}`
      );
    }

    const proposal = await getProposalById(stateStore, project.winner);

    let caseAccount;
    if (asset.caseType === ACCOUNT.PROPOSAL) {
      caseAccount = await getProposalById(stateStore, asset.caseId);
    } else if (asset.caseType === ACCOUNT.TEAM) {
      caseAccount = await getTeamById(stateStore, asset.caseId);
    }

    let disputeType,
      defendant,
      targetFundAccount,
      targetFundStatus,
      caseStatus,
      litigantFreezedFee,
      defendantFreezedFee;
    let caseAmount = BigInt(0);

    if (
      asset.caseType === ACCOUNT.PROPOSAL &&
      caseAccount.status === STATUS.PROPOSAL.REJECTED &&
      [
        STATUS.PROJECT.REFUSED,
        STATUS.PROJECT.DISPUTED,
        STATUS.PROJECT.DISPUTE_CLOSED,
      ].includes(project.status)
    ) {
      disputeType = MISCELLANEOUS.DISPUTE_TYPE.LEADER_VS_EMPLOYER;
      defendant = caseAccount.employer;
      caseStatus = STATUS.PROPOSAL.DISPUTED;
      targetFundStatus = STATUS.PROJECT.DISPUTED;
      targetFundAccount = project;
      caseAmount = targetFundAccount.prize;
      litigantFreezedFee = targetFundAccount.commitmentFee;
      defendantFreezedFee =
        (BigInt(targetFundAccount.prize) *
          BigInt(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERMYRIAD)) /
        BigInt(10000);
      defendantFreezedFee =
        BigInt(defendantFreezedFee) -
        BigInt(
          (defendantFreezedFee *
            BigInt(MISCELLANEOUS.EMPLOYER_REJECTION_PINALTY_PERMYRIAD)) /
            BigInt(10000)
        );

      if (caseAccount.leader !== senderAddress) {
        throw new Error(
          "You are not the leadear of this proposal account, you are not allowed to open disputes"
        );
      }

      if (project.winner !== caseAccount.id) {
        throw new Error(
          "this proposal case account is not associated with project account"
        );
      }
    } else if (
      asset.caseType === ACCOUNT.TEAM &&
      caseAccount.status === STATUS.TEAM.REJECTED &&
      caseAccount.forceReject === false &&
      [STATUS.PROPOSAL.SUBMITTED, STATUS.PROPOSAL.DISPUTE_CLOSED].includes(
        proposal.status
      ) &&
      BigInt(proposal.freezedFund) >= BigInt(proposal.potentialEarning) &&
      [
        STATUS.PROJECT.FINISHED,
        STATUS.PROJECT.TERMINATED,
        STATUS.PROJECT.DISPUTED,
        STATUS.PROJECT.DISPUTE_CLOSED,
      ].includes(project.status)
    ) {
      disputeType = MISCELLANEOUS.DISPUTE_TYPE.TEAM_VS_LEADER;
      defendant = caseAccount.leader;
      caseStatus = STATUS.TEAM.DISPUTED;
      targetFundStatus = STATUS.PROPOSAL.DISPUTED;
      targetFundAccount = proposal;
      caseAmount = caseAccount.potentialEarning;
      litigantFreezedFee = targetFundAccount.term.commitmentFee;
      defendantFreezedFee = project.commitmentFee;

      if (caseAccount.worker !== senderAddress) {
        throw new Error(
          "You are not the worker of this team account, you are not allowed to open disputes"
        );
      }

      if (caseAccount.project !== project.id) {
        throw new Error(
          "this team case account is not associated with project account"
        );
      }
    } else {
      throw new Error("FATAL: Can't identify dispute type");
    }

    let teamVsLeaderPinaltyPool = BigInt(0);

    const id = generateID(senderAddress, transaction.nonce);

    const DisputeAsset = {
      id: id,
      disputeType: disputeType,
      timestamp: asset.timestamp,
      maxDays: asset.maxDays,
      litigant: senderAddress,
      defendant: defendant,
      project: project.id,
      case: caseAccount.id,
      caseType: asset.caseType,
      targetFundAccount: targetFundAccount.id,
      targetFundAccountType: null,
      suit: asset.suit,
      vote: {
        litigant: [],
        defendant: [],
      },
      score: {
        litigant: BigInt(0),
        defendant: BigInt(0),
      },
      winner: null,
      status: STATUS.DISPUTE.OPEN,
      freezedFund:
        (BigInt(caseAmount) * BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
        BigInt(10000),
      litigantFreezedFee:
        (BigInt(litigantFreezedFee) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
        BigInt(10000),
      defendantFreezedFee:
        (BigInt(defendantFreezedFee) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
        BigInt(10000),
      castVoteFee:
        (BigInt(caseAmount) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD) *
          BigInt(MISCELLANEOUS.DISPUTE_VOTE_FEE_PERMYRIAD)) /
        BigInt(10000),
    };

    if (asset.caseType === ACCOUNT.PROPOSAL) {
      caseAccount.status = caseStatus;
      await setProposalById(stateStore, caseAccount.id, caseAccount);
    } else if (asset.caseType === ACCOUNT.TEAM) {
      caseAccount.oldStatus = caseAccount.status;
      caseAccount.status = caseStatus;
      await setTeamById(stateStore, caseAccount.id, caseAccount);
    }

    project.status = STATUS.PROJECT.DISPUTED;
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_OPEN_DISPUTE_ASSET_ID,
    });

    if (disputeType === MISCELLANEOUS.DISPUTE_TYPE.TEAM_VS_LEADER) {
      DisputeAsset.targetFundAccountType = ACCOUNT.PROPOSAL;
      teamVsLeaderPinaltyPool =
        targetFundAccount.guilty === false
          ? BigInt(targetFundAccount.potentialEarning)
          : BigInt(0);
      targetFundAccount.status = targetFundStatus;
      targetFundAccount.freezedFund =
        BigInt(targetFundAccount.freezedFund) -
        (BigInt(caseAmount) * BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000) -
        (BigInt(teamVsLeaderPinaltyPool) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000);
      targetFundAccount.freezedFee =
        BigInt(targetFundAccount.freezedFee) -
        (BigInt(litigantFreezedFee) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000) -
        (BigInt(defendantFreezedFee) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000);
      DisputeAsset.freezedFund +=
        (BigInt(teamVsLeaderPinaltyPool) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
        BigInt(10000);
      await setProposalById(
        stateStore,
        targetFundAccount.id,
        targetFundAccount
      );
    } else if (disputeType === MISCELLANEOUS.DISPUTE_TYPE.LEADER_VS_EMPLOYER) {
      // if disputeType is Leader vs Employer, then the targetFundAccount is a projectAccount
      // we don't want store.account.set to be executed twice for targetFundAccount and projectAccount
      DisputeAsset.targetFundAccountType = ACCOUNT.PROJECT;
      project.freezedFund -=
        (BigInt(project.prize) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
        BigInt(10000);
      project.freezedFee =
        BigInt(project.freezedFee) -
        (BigInt(litigantFreezedFee) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000) -
        (BigInt(defendantFreezedFee) *
          BigInt(MISCELLANEOUS.DISPUTE_SEIZURE_PERMYRIAD)) /
          BigInt(10000);
    }

    project.openedDisputes.unshift(id);
    await setProjectById(stateStore, project.id, project);

    const allDispute = await getAllDispute(stateStore);
    allDispute.availableDispute.unshift(id);
    await setAllDispute(stateStore, allDispute);
    await setDisputeById(stateStore, id, DisputeAsset);
  }
}

module.exports = { OpenDisputeAsset };
