const { STATUS, ACCOUNT } = require("./constants");
const { store_account_get } = require("./utils");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by employer.
 * As opposite to terminateWork, cancelWork is try to protect employer from trolling leader / worker,
 * when they not have submit any files, or let the revision exceed maxTime limit.
 * Employer can cancel the work, and after freezed period, prize will claimed and be back to employer.
 * Cancelled work are final, and can't be open to dispute, because it's crystal clear leader not submit any work until maxTime is exceeded
 *
 * Required:
 * this.asset.projectPublicKey
 */
class CancelWorkTransaction extends BaseTransaction {
  static get TYPE() {
    return 115;
  }

  /**
   * Set the `CancelWorkTransaction` transaction FEE to 0.
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    return `0`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   * In this case, sender and project account will be cached
   */
  async prepare(store) {
    await store.account.cache([
      {
        address: this.senderId,
      },
      {
        address: getAddressFromPublicKey(this.asset.projectPublicKey),
      },
    ]);

    const projectAccount = store.account.get(
      getAddressFromPublicKey(this.asset.projectPublicKey)
    );
    await store.account.cache([
      {
        address: getAddressFromPublicKey(projectAccount.asset.winner),
      },
    ]);

    const proposalAccount = store.account.get(
      getAddressFromPublicKey(projectAccount.asset.winner)
    );
    if (proposalAccount.asset.team.filter((el) => el !== 0).length > 0) {
      await store.account.cache({
        address_in: proposalAccount.asset.team
          .filter((el) => el !== 0)
          .map((item) => getAddressFromPublicKey(item)),
      });
    }
  }

  /**
   * Validation of asset property
   */
  validateAsset() {
    const errors = [];
    if (
      !this.asset.projectPublicKey ||
      typeof this.asset.projectPublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.projectPublicKey" defined on transaction',
          this.id,
          ".asset.projectPublicKey",
          this.asset.projectPublicKey,
          "projectPublicKey is required, and must be string"
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
      const projectAccount = store_account_get(
        this.asset.projectPublicKey,
        store
      );
      const proposalAccount = store_account_get(
        projectAccount.asset.winner,
        store
      );
      const teamAccounts = [];
      proposalAccount.asset.team
        .filter((el) => el !== 0)
        .forEach((item) => {
          teamAccounts.push(store_account_get(item, store));
        });
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type !== ACCOUNT.EMPLOYER
      ) {
        errors.push(
          new TransactionError(
            "Sender is not employer",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type mush be ${ACCOUNT.EMPLOYE}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(projectAccount.asset, "type") &&
        projectAccount.asset.type !== ACCOUNT.PROJECT
      ) {
        errors.push(
          new TransactionError(
            "specified projectPublicKey is not a project account",
            this.id,
            "projectAccount.asset.type",
            projectAccount.asset.type,
            `Type mush be ${ACCOUNT.PROJECT}`
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
            `Project account status not in ${[
              STATUS.PROJECT.WORKING,
              STATUS.PROJECT.REQUEST_REVISION,
            ].toString()}`,
            this.id,
            "projectAccount.asset.status",
            projectAccount.asset.status,
            `Status must be in ${[
              STATUS.PROJECT.WORKING,
              STATUS.PROJECT.REQUEST_REVISION,
            ].toString()}`
          )
        );
      }
      if (projectAccount.asset.employer !== sender.address) {
        errors.push(
          new TransactionError(
            "sender is not employer of project",
            this.id,
            "sender.address",
            sender.address,
            "Employer is: " + projectAccount.asset.employer
          )
        );
      }
      if (
        ![STATUS.PROPOSAL.SELECTED, STATUS.PROPOSAL.REQUEST_REVISION].includes(
          proposalAccount.asset.status
        )
      ) {
        errors.push(
          new TransactionError(
            `proposal status not in ${[
              STATUS.PROPOSAL.SELECTED,
              STATUS.PROPOSAL.REQUEST_REVISION,
            ].toString()}`,
            this.id,
            "proposalAccount.asset.status",
            proposalAccount.asset.status,
            `Status must be in ${[
              STATUS.PROPOSAL.SELECTED,
              STATUS.PROPOSAL.REQUEST_REVISION,
            ].toString()}`
          )
        );
      }
      if (
        this.timestamp <
        projectAccount.asset.workStarted + projectAccount.asset.maxTime * 86400
      ) {
        errors.push(
          new TransactionError(
            "maxTime is not yet passed, let's wait for worker to submit their work, they still have time",
            this.id,
            "this.timestamp",
            this.timestamp,
            `Its still ${
              projectAccount.asset.workStarted +
              projectAccount.asset.maxTime * 86400 -
              this.timestamp
            } more seconds from maxTime limit`
          )
        );
      }
      if (errors.length === 0) {
        const proposalAsset = proposalAccount.asset;
        proposalAsset.oldFreezedFee = proposalAsset.freezedFee;
        const projectAsset = {
          ...projectAccount.asset,
          workFinished: this.timestamp,
          oldStatus: projectAccount.asset.status,
          status: STATUS.PROJECT.CANCELLED,
        };
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        teamAccounts.forEach((team) => {
          const teamAsset = team.asset;
          teamAsset.oldFreezedFee = teamAsset.freezedFee;
          if ([STATUS.TEAM.SUBMITTED].includes(team.asset.status)) {
            teamAsset.forceCancel = true;
            projectAsset.freezedFund = utils
              .BigNum(projectAsset.freezedFund)
              .add(teamAsset.potentialEarning)
              .toString();
            teamAsset.freezedFund = utils
              .BigNum(teamAsset.freezedFund)
              .sub(teamAsset.potentialEarning)
              .toString();
          } else {
            proposalAsset.freezedFee = utils
              .BigNum(proposalAsset.freezedFee)
              .sub(proposalAccount.asset.term.commitmentFee)
              .toString();
            teamAsset.freezedFee = utils
              .BigNum(teamAsset.freezedFee)
              .add(proposalAccount.asset.term.commitmentFee)
              .toString();
          }
          store.account.set(team.address, {
            ...team,
            asset: teamAsset,
          });
        });
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
    const projectAccount = store.account.get(this.asset.projectPublicKey);
    const proposalAccount = store_account_get(
      projectAccount.asset.winner,
      store
    );
    const teamAccounts = [];
    proposalAccount.asset.team
      .filter((el) => el !== 0)
      .forEach((item) => {
        teamAccounts.push(store_account_get(item, store));
      });
    const proposalAsset = proposalAccount.asset;
    proposalAsset.freezedFee = proposalAsset.oldFreezedFee;
    delete proposalAsset.oldFreezedFee;
    const projectAsset = {
      ...projectAccount.asset,
      workFinished: null,
      status: projectAccount.asset.oldStatus,
    };
    projectAsset.activity.shift();
    delete projectAsset.oldStatus;
    teamAccounts.forEach((team) => {
      const teamAsset = team.asset;
      if (team.asset.forceCancel === true) {
        teamAsset.forceCancel = false;
        projectAsset.freezedFund = utils
          .BigNum(projectAsset.freezedFund)
          .sub(teamAsset.potentialEarning)
          .toString();
        teamAsset.freezedFund = utils
          .BigNum(teamAsset.freezedFund)
          .add(teamAsset.potentialEarning)
          .toString();
      }
      teamAsset.freezedFee = teamAsset.oldFreezedFee;
      delete teamAsset.oldFreezedFee;
      store.account.set(team.address, {
        ...team,
        asset: teamAsset,
      });
    });
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

module.exports = CancelWorkTransaction;
