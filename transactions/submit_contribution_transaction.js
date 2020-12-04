const { store_account_get } = require("./utils");
const { STATUS, ACCOUNT, MISCELLANEOUS } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by team member.
 * To submit their contribution to the team.
 *
 * Required:
 * this.asset.contributionPublicKey [@fresh]
 * this.asset.teamPublicKey
 * this.asset.fileextension
 * this.asset.filemime
 * this.asset.filename
 * this.asset.filedata
 */
class SubmitContributionTransaction extends BaseTransaction {
  static get TYPE() {
    return 108;
  }

  /**
   * Set the `SubmitContributionTransaction` transaction FEE to 0.
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    return `0`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   * In this case, sender account and team account will be cached
   * Proposal account also will be cached, according to team account
   * proposal account is where collaboration term is stored
   */
  async prepare(store) {
    await store.account.cache([
      {
        address: this.senderId,
      },
      {
        address: getAddressFromPublicKey(this.asset.teamPublicKey),
      },
      {
        address: getAddressFromPublicKey(this.asset.contributionPublicKey),
      },
    ]);

    const teamAccount = store.account.get(
      getAddressFromPublicKey(this.asset.teamPublicKey)
    );
    await store.account.cache([
      {
        address: getAddressFromPublicKey(teamAccount.asset.proposal),
      },
      {
        address: getAddressFromPublicKey(teamAccount.asset.project),
      },
    ]);
  }

  /**
   * Validation of asset property
   */
  validateAsset() {
    const errors = [];
    if (
      !this.asset.teamPublicKey ||
      typeof this.asset.teamPublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.teamPublicKey" defined on transaction',
          this.id,
          ".asset.teamPublicKey",
          this.asset.teamPublicKey,
          "teamPublicKey is required, and must be string"
        )
      );
    }
    if (
      !this.asset.contributionPublicKey ||
      typeof this.asset.contributionPublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.contributionPublicKey" defined on transaction',
          this.id,
          ".asset.contributionPublicKey",
          this.asset.contributionPublicKey,
          "contributionPublicKey is required, and must be string"
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
      const teamAccount = store_account_get(this.asset.teamPublicKey, store);
      const proposalAccount = store_account_get(
        teamAccount.asset.proposal,
        store
      );
      const contributionAccount = store_account_get(
        this.asset.contributionPublicKey,
        store
      );
      const projectAccount = store_account_get(
        teamAccount.asset.project,
        store
      );
      if (Object.keys(contributionAccount.asset).length != 0) {
        errors.push(
          new TransactionError(
            "Specified File Account needs to be a fresh account, to be used as file stored on blockchain",
            this.id,
            "contributionAccount.asset",
            contributionAccount.asset,
            "Account cant have any additional values"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(teamAccount.asset, "type") &&
        teamAccount.asset.type != ACCOUNT.TEAM
      ) {
        errors.push(
          new TransactionError(
            "Specified teamPublicKey is not a team account",
            this.id,
            "teamAccount.asset.type",
            teamAccount.asset.type,
            `Type needs to be ${ACCOUNT.TEAM}`
          )
        );
      }
      if (
        ![STATUS.TEAM.SELECTED, STATUS.TEAM.REQUEST_REVISION].includes(
          teamAccount.asset.status
        )
      ) {
        errors.push(
          new TransactionError(
            `Team account status is not ${STATUS.TEAM.SELECTED} or ${STATUS.TEAM.REQUEST_REVISION}, therefore you can't submit contribution`,
            this.id,
            "teamAccount.asset.status",
            teamAccount.asset.status,
            `Status must be ${STATUS.TEAM.SELECTED} or ${STATUS.TEAM.REQUEST_REVISION}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(proposalAccount.asset, "type") &&
        proposalAccount.asset.type != ACCOUNT.PROPOSAL
      ) {
        errors.push(
          new TransactionError(
            "Fatal: proposal recorded on team account is not a proposal account",
            this.id,
            "proposalAccount.asset.type",
            proposalAccount.asset.type,
            `Type needs to be ${ACCOUNT.PROPOSAL}`
          )
        );
      }
      if (
        proposalAccount.asset.term.roleList.length > 0 &&
        proposalAccount.asset.term.maxRevision != null &&
        teamAccount.asset.contribution.length >=
          proposalAccount.asset.term.maxRevision
      ) {
        errors.push(
          new TransactionError(
            "Exceed Max Revision Limit, You can't submit contribution anymore",
            this.id,
            "teamAccount.asset.contribution.length",
            teamAccount.asset.contribution.length,
            "maxRevision is: " + proposalAccount.asset.term.maxRevision
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type != ACCOUNT.WORKER
      ) {
        errors.push(
          new TransactionError(
            "You are not worker, you are not allowed to submit contribution",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type needs to be ${ACCOUNT.WORKER}`
          )
        );
      }
      if (teamAccount.asset.worker != sender.address) {
        errors.push(
          new TransactionError(
            "You are not the owner of this team account, you are not allowed to submit contribution",
            this.id,
            "sender.address",
            sender.address,
            "owner is: " + teamAccount.asset.worker
          )
        );
      }
      if (
        this.timestamp >
        projectAccount.asset.workStarted + projectAccount.asset.maxTime * 86400
      ) {
        errors.push(
          new TransactionError(
            "maxTime is passed, you can't do this anymore",
            this.id,
            "this.timestamp",
            this.timestamp,
            `This transaction must be executed before time limit`
          )
        );
      }
      if (errors.length == 0) {
        const contributionAsset = {
          type: ACCOUNT.CONTRIBUTION,
          owner: sender.address,
          project: teamAccount.asset.project,
          proposal: teamAccount.asset.proposal,
          team: teamAccount.publicKey,
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
        const proposalAsset = proposalAccount.asset;
        proposalAsset.freezedFee = utils
          .BigNum(proposalAsset.freezedFee)
          .sub(proposalAsset.term.commitmentFee)
          .toString();
        const teamAsset = {
          contribution: [],
          ...teamAccount.asset,
          status: STATUS.TEAM.SUBMITTED,
          lastSubmitted: this.timestamp,
        };
        teamAsset.freezedFund = utils
          .BigNum(teamAsset.freezedFund)
          .add(teamAsset.potentialEarning)
          .toString();
        teamAsset.freezedFee = utils
          .BigNum(teamAsset.freezedFee)
          .add(proposalAsset.term.commitmentFee)
          .toString();
        const projectAsset = projectAccount.asset;
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        projectAsset.freezedFund = utils
          .BigNum(projectAsset.freezedFund)
          .sub(teamAsset.potentialEarning)
          .toString();
        teamAsset.contribution.unshift(contributionAccount.publicKey);
        senderAsset.file.unshift(contributionAccount.publicKey);
        store.account.set(proposalAccount.address, {
          ...proposalAccount,
          asset: proposalAsset,
        });
        store.account.set(contributionAccount.address, {
          ...contributionAccount,
          asset: contributionAsset,
        });
        store.account.set(sender.address, { ...sender, asset: senderAsset });
        store.account.set(teamAccount.address, {
          ...teamAccount,
          asset: teamAsset,
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
    const teamAccount = store_account_get(this.asset.teamPublicKey, store);
    const proposalAccount = store_account_get(
      teamAccount.asset.proposal,
      store
    );
    const contributionAccount = store_account_get(
      this.asset.contributionPublicKey,
      store
    );
    const projectAccount = store_account_get(teamAccount.asset.project, store);
    const senderAsset = {
      file: [],
      ...sender.asset,
    };
    const proposalAsset = proposalAccount.asset;
    proposalAsset.freezedFee = utils
      .BigNum(proposalAsset.freezedFee)
      .add(proposalAsset.term.commitmentFee)
      .toString();
    const teamAsset = {
      contribution: [],
      ...teamAccount.asset,
      status: STATUS.TEAM.SELECTED,
      lastSubmitted: null,
    };
    teamAsset.freezedFund = utils
      .BigNum(teamAsset.freezedFund)
      .sub(teamAsset.potentialEarning)
      .toString();
    teamAsset.freezedFee = utils
      .BigNum(teamAsset.freezedFee)
      .sub(proposalAsset.term.commitmentFee)
      .toString();
    const fileTeamIndex = teamAsset.contribution.indexOf(
      contributionAccount.publicKey
    );
    if (fileTeamIndex > -1) {
      teamAsset.contribution.splice(fileTeamIndex, 1);
    }
    const workerTeamIndex = senderAsset.file.indexOf(
      contributionAccount.publicKey
    );
    if (workerTeamIndex > -1) {
      senderAsset.file.splice(workerTeamIndex, 1);
    }
    const projectAsset = projectAccount.asset;
    projectAsset.activity.shift();
    projectAsset.freezedFund = utils
      .BigNum(projectAsset.freezedFund)
      .add(teamAsset.potentialEarning)
      .toString();
    store.account.set(proposalAccount.address, {
      ...proposalAccount,
      asset: proposalAsset,
    });
    store.account.set(contributionAccount.address, {
      ...contributionAccount,
      asset: null,
    });
    store.account.set(sender.address, { ...sender, asset: senderAsset });
    store.account.set(teamAccount.address, {
      ...teamAccount,
      asset: teamAsset,
    });
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    return [];
  }
}

module.exports = SubmitContributionTransaction;
