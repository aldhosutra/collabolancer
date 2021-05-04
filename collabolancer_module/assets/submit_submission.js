const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const { COLLABOLANCER_SUBMIT_SUBMISSION_ASSET_ID } = require("../constants/id");
const STATUS = require("../constants/status");
const { SubmitSubmissionAssetSchema } = require("../schemas/asset");
const {
  getProposalById,
  getProjectById,
  generateID,
  setProposalById,
  setProjectById,
  setAllFile,
  getAllFile,
  setSubmissionById,
} = require("../utils/chain_state");

class SubmitSubmissionAsset extends BaseAsset {
  name = "submitSubmission";
  id = COLLABOLANCER_SUBMIT_SUBMISSION_ASSET_ID;
  schema = SubmitSubmissionAssetSchema;

  validate({ asset }) {
    if (!asset.proposalId || typeof asset.proposalId !== "string") {
      throw new Error(
        `Invalid "asset.proposalId" defined on transaction: Valid string is expected`
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
    const proposal = await getProposalById(stateStore, asset.proposalId);

    if (!proposal) {
      throw new Error("Proposal data doesn't exists");
    }

    const project = await getProjectById(stateStore, proposal.project);
    const allFile = await getAllFile(stateStore);

    if (
      ![STATUS.PROJECT.WORKING, STATUS.PROJECT.REQUEST_REVISION].includes(
        project.status
      )
    ) {
      throw new Error(
        `Project account status is not ${STATUS.PROJECT.WORKING} or ${STATUS.PROJECT.REQUEST_REVISION}, therefore you can't submit work submission`
      );
    }

    if (project.submission.length >= project.maxRevision) {
      throw new Error(
        `Exceed Max Revision Limit, You can't submit work submission anymore`
      );
    }

    if (senderAccount.collabolancer.accountType !== ACCOUNT.WORKER) {
      throw new Error("Sender must be an Worker");
    }

    if (proposal.leader !== senderAddress) {
      throw new Error("You are not the leadear of this proposal account");
    }

    if (proposal.id !== project.winner) {
      throw new Error(
        "This proposal account is not the winner of the project, therefore work submission is not allowed"
      );
    }

    if (asset.timestamp > project.workStarted + project.maxTime * 86400) {
      throw new Error(
        "maxTime is passed, you can't submit contribution anymore"
      );
    }

    const id = generateID(senderAddress, transaction.nonce);

    const SubmissionAsset = {
      id: id,
      owner: senderAddress,
      project: project.id,
      proposal: proposal.id,
      time: asset.timestamp,
      extension: asset.extension,
      mime: asset.mime,
      filename: asset.name,
      data: asset.data,
    };

    proposal.status = STATUS.PROPOSAL.SUBMITTED;
    proposal.lastSubmitted = asset.timestamp;
    proposal.freezedFund += BigInt(proposal.potentialEarning);
    proposal.freezedFee += BigInt(project.commitmentFee);

    project.status = STATUS.PROJECT.SUBMITTED;
    project.activity.unshift({
      timestamp: asset.timestamp,
      id: transaction.id,
      activityType: COLLABOLANCER_SUBMIT_SUBMISSION_ASSET_ID,
    });
    project.freezedFund -= BigInt(proposal.potentialEarning);
    project.freezedFee -= BigInt(project.commitmentFee);

    senderAccount.collabolancer.worker.file.unshift(id);
    project.submission.unshift(id);
    allFile.push(id);

    await setSubmissionById(stateStore, id, SubmissionAsset);
    await setProposalById(stateStore, proposal.id, proposal);
    await setProjectById(stateStore, project.id, project);
    await setAllFile(stateStore, allFile);
    await stateStore.account.set(senderAccount.address, senderAccount);
  }
}

module.exports = { SubmitSubmissionAsset };
