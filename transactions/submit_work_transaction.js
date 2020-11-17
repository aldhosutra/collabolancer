const { store_account_get } = require("./utils");
const { STATUS, ACCOUNT, MISCELLANEOUS } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by team leader,
 * that being selected in a project by project owner
 *
 * Required:
 * this.asset.submissionPublicKey [@fresh]
 * this.asset.proposalPublicKey
 * this.asset.fileextension
 * this.asset.filemime
 * this.asset.filename
 * this.asset.filedata
 */
class SubmitWorkTransaction extends BaseTransaction {
  static get TYPE() {
    return 110;
  }

  /**
   * Set the `SubmitWorkTransaction` transaction FEE to 0.
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    return `0`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   * In this case, sender account and team account will be cached
   * Proposal account also will be cached, and correspoding project will be cached
   * Generated work submission file account will also be cached
   */
  async prepare(store) {
    await store.account.cache([
      {
        address: this.senderId,
      },
      {
        address: getAddressFromPublicKey(this.asset.proposalPublicKey),
      },
      {
        address: getAddressFromPublicKey(this.asset.submissionPublicKey),
      },
    ]);

    const proposalAccount = store.account.get(
      getAddressFromPublicKey(this.asset.proposalPublicKey)
    );
    await store.account.cache([
      {
        address: getAddressFromPublicKey(proposalAccount.asset.project),
      },
    ]);
  }

  /**
   * Validation of asset property
   */
  validateAsset() {
    const errors = [];
    if (
      !this.asset.proposalPublicKey ||
      typeof this.asset.proposalPublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.proposalPublicKey" defined on transaction',
          this.id,
          ".asset.proposalPublicKey",
          this.asset.proposalPublicKey,
          "proposalPublicKey is required, and must be string"
        )
      );
    }
    if (
      !this.asset.submissionPublicKey ||
      typeof this.asset.submissionPublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.submissionPublicKey" defined on transaction',
          this.id,
          ".asset.submissionPublicKey",
          this.asset.submissionPublicKey,
          "submissionPublicKey is required, and must be string"
        )
      );
    }
    if (
      !this.asset.fileextension ||
      typeof this.asset.fileextension !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.fileextension" defined on transaction',
          this.id,
          ".asset.filemime",
          this.asset.fileextension,
          "fileextension is required, and must be string"
        )
      );
    }
    if (!this.asset.filemime || typeof this.asset.filemime !== "string") {
      errors.push(
        new TransactionError(
          'Invalid "asset.filemime" defined on transaction',
          this.id,
          ".asset.filemime",
          this.asset.filemime,
          "filemime is required, and must be string"
        )
      );
    }
    if (!this.asset.filename || typeof this.asset.filename !== "string") {
      errors.push(
        new TransactionError(
          'Invalid "asset.filename" defined on transaction',
          this.id,
          ".asset.filename",
          this.asset.filename,
          "filename is required, and must be string"
        )
      );
    }
    if (!this.asset.filedata) {
      errors.push(
        new TransactionError(
          'Invalid "binary" defined on transaction',
          this.id,
          ".asset.data.filedata",
          this.asset.filedata,
          "filedata is required"
        )
      );
    }
    if (this.asset.filedata.length > MISCELLANEOUS.FILE_MAXSIZE) {
      errors.push(
        new TransactionError(
          "File too large",
          this.id,
          ".asset.data.filedata",
          this.asset.filedata,
          `File size is: ${this.asset.filedata.length.toString()}, larger than Max ${
            MISCELLANEOUS.FILE_MAXSIZE
          }`
        )
      );
    }
    return errors;
  }

  /**
   * applyAsset is where the custom logic is implemented.
   * applyAsset() and undoAsset() uses the information from the `store`.
   */
  applyAsset(store) {
    const errors = [];
    try {
      const sender = store.account.get(this.senderId);
      const proposalAccount = store_account_get(
        this.asset.proposalPublicKey,
        store
      );
      const projectAccount = store_account_get(
        proposalAccount.asset.project,
        store
      );
      const submissionAccount = store_account_get(
        this.asset.submissionPublicKey,
        store
      );
      if (Object.keys(submissionAccount.asset).length != 0) {
        errors.push(
          new TransactionError(
            "Specified File Account needs to be a fresh account, to be used as file stored on blockchain",
            this.id,
            ".asset.submissionPublicKey",
            submissionAccount.asset,
            "Account cant have any additional values"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(proposalAccount.asset, "type") &&
        proposalAccount.asset.type != ACCOUNT.PROPOSAL
      ) {
        errors.push(
          new TransactionError(
            "Specified proposalPublicKey is not a proposal account",
            this.id,
            ".asset.proposalPublicKey",
            proposalAccount.asset.type,
            `Type needs to be ${ACCOUNT.PROPOSAL}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(projectAccount.asset, "type") &&
        projectAccount.asset.type != ACCOUNT.PROJECT
      ) {
        errors.push(
          new TransactionError(
            "Fatal: project recorded on proposal account is not a project account",
            this.id,
            "projectAccount.asset.type",
            projectAccount.asset.type,
            `Type needs to be ${ACCOUNT.PROJECT}`
          )
        );
      }
      if (
        ![STATUS.PROJECT.WORKING, STATUS.PROJECT.REQUEST_REVISION].includes(
          projectAccount.asset.status
        )
      ) {
        errors.push(
          new TransactionError(
            `Project account status is not ${STATUS.PROJECT.WORKING} or ${STATUS.PROJECT.REQUEST_REVISION}, therefore you can't submit work submission`,
            this.id,
            "projectAccount.asset.status",
            projectAccount.asset.status,
            `Status must be ${STATUS.PROJECT.WORKING} or ${STATUS.PROJECT.REQUEST_REVISION}`
          )
        );
      }
      if (
        projectAccount.asset.maxRevision != null &&
        projectAccount.asset.submission.length >=
          projectAccount.asset.maxRevision
      ) {
        errors.push(
          new TransactionError(
            "Exceed Max Revision Limit, You can't submit work submission anymore",
            this.id,
            "projectAccount.asset.submission.length",
            projectAccount.asset.submission.length,
            "maxRevision is: " + projectAccount.asset.maxRevision
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type != ACCOUNT.WORKER
      ) {
        errors.push(
          new TransactionError(
            "You are not worker, you are not allowed to submit work",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type needs to be ${ACCOUNT.WORKER}`
          )
        );
      }
      if (proposalAccount.asset.leader != sender.address) {
        errors.push(
          new TransactionError(
            "You are not the leadear of this proposal account, you are not allowed to submit work",
            this.id,
            "sender.address",
            sender.address,
            "owner is: " + proposalAccount.asset.leader
          )
        );
      }
      if (proposalAccount.publicKey != projectAccount.asset.winner) {
        errors.push(
          new TransactionError(
            "This proposal account is not the winner of the project, therefore work submission is not allowed",
            this.id,
            ".asset.proposalPublicKey",
            this.asset.proposalPublicKey,
            "winner is: " + projectAccount.asset.winner
          )
        );
      }
      if (errors.length == 0) {
        const submissionAsset = {
          type: ACCOUNT.SUBMISSION,
          owner: sender.address,
          project: projectAccount.publicKey,
          proposal: proposalAccount.publicKey,
          time: this.timestamp,
          extension: this.asset.fileextension,
          mime: this.asset.filemime,
          filename: this.asset.filename,
          dataTransaction: this.id,
        };
        const senderAsset = {
          file: [],
          ...sender.asset,
        };
        const proposalAsset = {
          ...proposalAccount.asset,
          status: STATUS.PROPOSAL.SUBMITTED,
          lastSubmitted: this.timestamp,
        };
        proposalAsset.freezedFund = utils
          .BigNum(proposalAsset.freezedFund)
          .add(proposalAsset.potentialEarning)
          .toString();
        proposalAsset.freezedFee = utils
          .BigNum(proposalAsset.freezedFee)
          .add(projectAccount.asset.commitmentFee)
          .toString();
        const projectAsset = {
          submission: [],
          ...projectAccount.asset,
          status: STATUS.PROJECT.SUBMITTED,
        };
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        projectAsset.freezedFund = utils
          .BigNum(projectAsset.freezedFund)
          .sub(proposalAsset.potentialEarning)
          .toString();
        projectAsset.freezedFee = utils
          .BigNum(projectAsset.freezedFee)
          .sub(projectAsset.commitmentFee)
          .toString();
        senderAsset.file.unshift(submissionAccount.publicKey);
        projectAsset.submission.unshift(submissionAccount.publicKey);
        store.account.set(submissionAccount.address, {
          ...submissionAccount,
          asset: submissionAsset,
        });
        store.account.set(sender.address, { ...sender, asset: senderAsset });
        store.account.set(proposalAccount.address, {
          ...proposalAccount,
          asset: proposalAsset,
        });
        store.account.set(projectAccount.address, {
          ...projectAccount,
          asset: projectAsset,
        });
      }
    } catch (err) {
      console.log(err);
      errors.push(
        new TransactionError(`[Unexpected Error] - ${err.toString()}`)
      );
    }
    return errors; // array of TransactionErrors, returns empty array if no errors are thrown
  }

  /**
   * Inverse of `applyAsset`.
   * Undoes the changes made in applyAsset()
   */
  undoAsset(store) {
    const sender = store.account.get(this.senderId);
    const proposalAccount = store_account_get(
      this.asset.proposalPublicKey,
      store
    );
    const projectAccount = store_account_get(
      proposalAccount.asset.project,
      store
    );
    const submissionAccount = store_account_get(
      this.asset.submissionPublicKey,
      store
    );
    const senderAsset = {
      file: [],
      ...sender.asset,
    };
    const proposalAsset = {
      ...proposalAccount.asset,
      status: STATUS.PROPOSAL.SELECTED,
      lastSubmitted: null,
    };
    proposalAsset.freezedFund = utils
      .BigNum(proposalAsset.freezedFund)
      .sub(proposalAsset.potentialEarning)
      .toString();
    proposalAsset.freezedFee = utils
      .BigNum(proposalAsset.freezedFee)
      .sub(projectAccount.asset.commitmentFee)
      .toString();
    const projectAsset = {
      submission: [],
      ...projectAccount.asset,
      status: STATUS.PROJECT.WORKING,
    };
    const projectSubmissionIndex = projectAsset.submission.indexOf(
      submissionAccount.publicKey
    );
    if (projectSubmissionIndex > -1) {
      projectAsset.submission.splice(projectSubmissionIndex, 1);
    }
    const workerTeamIndex = senderAsset.file.indexOf(
      submissionAccount.publicKey
    );
    if (workerTeamIndex > -1) {
      senderAsset.file.splice(workerTeamIndex, 1);
    }
    projectAsset.activity.shift();
    projectAsset.freezedFund = utils
      .BigNum(projectAsset.freezedFund)
      .add(proposalAsset.potentialEarning)
      .toString();
    projectAsset.freezedFee = utils
      .BigNum(projectAsset.freezedFee)
      .add(projectAsset.commitmentFee)
      .toString();
    store.account.set(submissionAccount.address, {
      ...submissionAccount,
      asset: null,
    });
    store.account.set(sender.address, { ...sender, asset: senderAsset });
    store.account.set(proposalAccount.address, {
      ...proposalAccount,
      asset: proposalAsset,
    });
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    return [];
  }
}

module.exports = SubmitWorkTransaction;
