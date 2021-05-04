const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const { COLLABOLANCER_REJECT_SUBMISSION_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const MISCELLANEOUS = require("../constants/miscellaneous");
const { RejectSubmissionAssetSchema } = require("../schemas/asset");
const { asyncForEach } = require("../utils/helper");
const {
  getTeamById,
  getProposalById,
  getProjectById,
  setProposalById,
  setTeamById,
  setProjectById,
  getSubmissionById,
} = require("../utils/chain_state");

class RejectSubmissionAsset extends BaseAsset {
  name = "rejectSubmission";
  id = COLLABOLANCER_REJECT_SUBMISSION_ASSET_ID;
  schema = RejectSubmissionAssetSchema;

  validate({ asset }) {
    if (!asset.submissionId || typeof asset.submissionId !== "string") {
      throw new Error(
        `Invalid "asset.submissionId" defined on transaction: Valid string is expected`
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
    const submission = await getSubmissionById(stateStore, asset.submissionId);

    if (!submission) {
      throw new Error("Submission data doesn't exists");
    }

    const proposal = await getProposalById(stateStore, submission.proposal);
    const project = await getProjectById(stateStore, submission.project);

    let teamAccounts = [];
    asyncForEach(
      proposal.team.filter((el) => el !== null),
      async (item) => {
        const teamItem = await getTeamById(stateStore, item);
        teamAccounts.push(teamItem);
      }
    );

    if (senderAccount.collabolancer.accountType !== ACCOUNT.EMPLOYER) {
      throw new Error("Sender must be an Employer");
    }

    if (project.employer !== senderAddress) {
      throw new Error(
        "You are not the employer of this related project submission"
      );
    }

    if (proposal.status !== STATUS.PROPOSAL.SUBMITTED) {
      throw new Error(`proposal status is not yet submitted`);
    }

    if (project.status !== STATUS.PROJECT.SUBMITTED) {
      throw new Error(`project status is not yet submitted`);
    }

    if (project.statusNote.length !== project.submission.length - 1) {
      throw new Error("statusNote length and submision length are not match");
    }

    let teamReason, reason, forceReject, teamStatus;
    let employerRejectionPinalty = BigInt(0);
    const pinaltyDivider = proposal.team.filter((el) => el !== null).length + 1;

    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_REJECT_SUBMISSION_ASSET_ID,
    });
    project.freezedFund += BigInt(proposal.potentialEarning);
    project.freezedFee += BigInt(project.commitmentFee);

    proposal.freezedFund -= BigInt(proposal.potentialEarning);
    proposal.freezedFee -= BigInt(project.commitmentFee);
    proposal.term.maxRevision += 1;

    if (
      project.submission.length >= project.maxRevision ||
      asset.timestamp > project.workStarted + project.maxTime * 86400
    ) {
      project.status = STATUS.PROJECT.REJECTED;
      proposal.status = STATUS.PROPOSAL.REJECTED;
      teamStatus = STATUS.TEAM.REJECTED;
      forceReject = true;
      let reasonPrefix =
        asset.timestamp > project.workStarted + project.maxTime * 86400
          ? "TIMEOUT REJECTION"
          : "MAX REVISION EXCEEDED";
      reason = `<p>${reasonPrefix}, your work are rejected, employer note: ${asset.reason}</p>`;
      teamReason = `<p>Employer Reject Submission, so your contribution also rejected. Employer note: ${asset.reason}</p>`;
      employerRejectionPinalty =
        (((BigInt(project.prize) *
          BigInt(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERMYRIAD)) /
          BigInt(10000)) *
          BigInt(MISCELLANEOUS.EMPLOYER_REJECTION_PINALTY_PERMYRIAD)) /
        BigInt(10000);
      project.freezedFee -= BigInt(employerRejectionPinalty);
    } else {
      project.status = STATUS.PROJECT.REQUEST_REVISION;
      proposal.status = STATUS.PROPOSAL.REQUEST_REVISION;
      teamStatus = STATUS.TEAM.REQUEST_REVISION;
      forceReject = false;
      reason = `<p>${asset.reason}</p>`;
      teamReason = `<p>Employer Request Revision for your leader's work, so your contribution also been requested for revision, maxRevision has been increased for your opportunity to resubmit revised version. Employer note: ${asset.reason}</p>`;
    }

    asyncForEach(teamAccounts, async (team) => {
      if (team.status === STATUS.TEAM.REJECTED) {
        proposal.freezedFund -= BigInt(team.potentialEarning);
        project.freezedFund += BigInt(team.potentialEarning);
      } else if (team.status === STATUS.TEAM.SUBMITTED) {
        if (teamStatus === STATUS.TEAM.REQUEST_REVISION) {
          proposal.freezedFee += BigInt(proposal.term.commitmentFee);
          team.freezedFee -= BigInt(proposal.term.commitmentFee);
        }
        team.status = teamStatus;
        team.forceReject = forceReject;
        team.freezedFund -= BigInt(team.potentialEarning);
        project.freezedFund += BigInt(team.potentialEarning);
        team.statusNote.unshift({
          time: asset.timestamp,
          status: teamStatus,
          contribution: forceReject ? "forceReject" : team.contribution[0],
          reason: teamReason,
        });
      } else if (
        [STATUS.TEAM.REQUEST_REVISION, STATUS.TEAM.SELECTED].includes(
          team.status
        ) &&
        teamStatus === STATUS.TEAM.REJECTED
      ) {
        team.status = teamStatus;
        team.forceReject = forceReject;
        team.statusNote.unshift({
          time: asset.timestamp,
          status: teamStatus,
          contribution: forceReject ? "forceReject" : team.contribution[0],
          reason: teamReason,
        });
      }
      team.freezedFee +=
        BigInt(employerRejectionPinalty) / BigInt(pinaltyDivider);
      await setTeamById(stateStore, team.id, team);
    });

    proposal.freezedFee +=
      BigInt(employerRejectionPinalty) / BigInt(pinaltyDivider);
    project.statusNote.unshift({
      time: asset.timestamp,
      status: project.status,
      submission: asset.submissionId,
      reason: reason,
    });

    await setProjectById(stateStore, project.id, project);
    await setProposalById(stateStore, proposal.id, proposal);
  }
}

module.exports = { RejectSubmissionAsset };
