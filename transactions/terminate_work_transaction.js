const { STATUS, ACCOUNT, MISCELLANEOUS } = require("./constants");
const { store_account_get } = require("./utils");
const {
  BaseTransaction,
  TransactionError,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by leader.
 * Executed when leader and team member have submitted all work according to term,
 * but employer doesn’t mark work as finish. So, after maxTime are passed,
 * leader execute this to change status to terminated, and after freezed period, prize can be claimed.
 *
 * Required:
 * this.asset.projectPublicKey
 */
class TerminateWorkTransaction extends BaseTransaction {
  static get TYPE() {
    return 114;
  }

  /**
   * Set the `TerminateWorkTransaction` transaction FEE to 0.
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
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type !== ACCOUNT.WORKER
      ) {
        errors.push(
          new TransactionError(
            "Sender is not worker",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type mush be ${ACCOUNT.WORKER}`
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
      if (projectAccount.asset.status !== STATUS.PROJECT.SUBMITTED) {
        errors.push(
          new TransactionError(
            `Project account status is not ${STATUS.PROJECT.SUBMITTED}, therefore you can't terminate this work`,
            this.id,
            "projectAccount.asset.status",
            projectAccount.asset.status,
            `Status must be ${STATUS.PROJECT.SUBMITTED}`
          )
        );
      }
      if (proposalAccount.asset.leader !== sender.address) {
        errors.push(
          new TransactionError(
            "sender is not leader of project",
            this.id,
            "sender.address",
            sender.address,
            "Ledaer is: " + proposalAccount.asset.leader
          )
        );
      }
      if (proposalAccount.asset.status !== STATUS.PROPOSAL.SUBMITTED) {
        errors.push(
          new TransactionError(
            `proposal status is not ${STATUS.PROJECT.SUBMITTED}, therefore cant terminate project`,
            this.id,
            "proposalAccount.asset.status",
            proposalAccount.asset.status,
            `Status must be ${STATUS.PROPOSAL.SUBMITTED}`
          )
        );
      }
      if (
        proposalAccount.asset.lastSubmitted !== null &&
        this.timestamp <
          proposalAccount.asset.lastSubmitted +
            MISCELLANEOUS.SUBMIT_TO_TERMINATE_MIN_PERIOD
      ) {
        errors.push(
          new TransactionError(
            "minimal period to terminate from last time work submitted, is not yet passed, therefore, termination is not available",
            this.id,
            "this.timestamp",
            this.timestamp,
            `Its still ${
              proposalAccount.asset.lastSubmitted +
              MISCELLANEOUS.SUBMIT_TO_TERMINATE_MIN_PERIOD -
              this.timestamp
            } more seconds`
          )
        );
      }
      if (
        this.timestamp <
        projectAccount.asset.workStarted + projectAccount.asset.maxTime * 86400
      ) {
        errors.push(
          new TransactionError(
            "maxTime is not yet passed, let's wait for employer to mark this project finished",
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
        const projectAsset = {
          ...projectAccount.asset,
          workFinished: this.timestamp,
          status: STATUS.PROJECT.TERMINATED,
        };
        projectAsset.terminated = true;
        projectAsset.canBeClaimedOn =
          this.timestamp + MISCELLANEOUS.FUND_FREEZED_PERIOD;
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
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
    const projectAsset = {
      ...projectAccount.asset,
      workFinished: null,
      status: STATUS.PROJECT.SUBMITTED,
    };
    projectAsset.terminated = false;
    projectAsset.canBeClaimedOn = null;
    projectAsset.activity.shift();
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    return [];
  }
}

module.exports = TerminateWorkTransaction;
