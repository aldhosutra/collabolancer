const { store_account_get } = require("./utils");
const { STATUS, ACCOUNT } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by project owner.
 * After Owner accept or reject the work, status will be set to finished, and workFinished will be set
 * Prize is not distributed yet, everyone have 1 day until claimPrizeTransaction is executed
 *
 * Required:
 * this.asset.projectPublicKey
 */
class FinishWorkTransaction extends BaseTransaction {
  static get TYPE() {
    return 112;
  }

  /**
   * Set the `FinishWorkTransaction` transaction FEE to 0.
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

    await store.account.cache([
      {
        address: getAddressFromPublicKey(
          store.account.get(
            getAddressFromPublicKey(this.asset.projectPublicKey)
          ).asset.winner
        ),
      },
    ]);

    await store.account.cache({
      address_in: store.account
        .get(
          getAddressFromPublicKey(
            store.account.get(
              getAddressFromPublicKey(this.asset.projectPublicKey)
            ).asset.winner
          )
        )
        .asset.team.filter((el) => el != 0)
        .map((el) => getAddressFromPublicKey(el)),
    });
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
      const teamAccounts = proposalAccount.asset.team
        .filter((el) => el != 0)
        .map((el) => store.account.get(getAddressFromPublicKey(el)));
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type != ACCOUNT.EMPLOYER
      ) {
        errors.push(
          new TransactionError(
            "Sender is not employer",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type mush be ${ACCOUNT.EMPLOYER}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(projectAccount.asset, "type") &&
        projectAccount.asset.type != ACCOUNT.PROJECT
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
        ![STATUS.PROJECT.SUBMITTED, STATUS.PROJECT.REJECTED].includes(
          projectAccount.asset.status
        )
      ) {
        errors.push(
          new TransactionError(
            `Project account status is not in ${[
              STATUS.PROJECT.SUBMITTED,
              STATUS.PROJECT.REJECTED,
            ].toString()}, therefore you can't finish this work`,
            this.id,
            "projectAccount.asset.status",
            projectAccount.asset.status,
            `Status must in ${[
              STATUS.PROJECT.SUBMITTED,
              STATUS.PROJECT.REJECTED,
            ].toString()}`
          )
        );
      }
      if (projectAccount.asset.employer != sender.address) {
        errors.push(
          new TransactionError(
            "sender is not owner of project",
            this.id,
            "sender.address",
            sender.address,
            "Owner is: " + projectAccount.asset.employer
          )
        );
      }
      if (
        this.timestamp <
          projectAccount.asset.workStarted +
            proposalAccount.asset.term.maxTime * 86400 &&
        teamAccounts
          .map((el) => el.asset.status)
          .includes(STATUS.TEAM.REQUEST_REVISION)
      ) {
        errors.push(
          new TransactionError(
            "proposal maxTime is not yet passed, and one or more team is still working on revision, please wait for them to finish their revision, they still have time",
            this.id,
            "this.timestamp",
            this.timestamp,
            `Its still ${
              projectAccount.asset.workStarted +
              proposalAccount.asset.term.maxTime * 86400 -
              this.timestamp
            } more seconds from maxTime limit`
          )
        );
      }
      if (errors.length == 0) {
        let projectStatus;
        if (projectAccount.asset.status == STATUS.PROJECT.SUBMITTED) {
          projectStatus = STATUS.PROJECT.FINISHED;
        } else if (projectAccount.asset.status == STATUS.PROJECT.REJECTED) {
          projectStatus = STATUS.PROJECT.REFUSED;
        }
        const projectAsset = {
          ...projectAccount.asset,
          workFinished: this.timestamp,
          oldStatus: projectAccount.asset.status,
          status: projectStatus,
        };
        projectAsset.activity.unshift(this.id);
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
    const projectAsset = {
      ...projectAccount.asset,
      workFinished: null,
      status: projectAccount.asset.oldStatus,
    };
    delete projectAsset.oldStatus;
    projectAsset.activity.shift();
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    return [];
  }
}

module.exports = FinishWorkTransaction;
