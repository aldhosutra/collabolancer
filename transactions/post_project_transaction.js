const { getStateCenterAccount, store_account_get } = require("./utils");
const { ACCOUNT, STATUS, MISCELLANEOUS } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by employer.
 * Purpose is to post new project, and set some project properties on asset
 *
 * Required:
 * this.asset.projectPublicKey [@fresh]
 * this.asset.title
 * this.asset.description
 * this.asset.category
 * this.asset.prize
 * this.asset.maxTime
 * this.asset.maxRevision
 */
class PostProjectTransaction extends BaseTransaction {
  static get TYPE() {
    return 104;
  }

  /**
   * Set the `PostProjectTransaction` transaction FEE to 0.1.
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    // return `${10 ** 8}`; // (= 1 LSK)
    return `${utils.convertLSKToBeddows("0.1")}`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   * In this case, sender account as employer that will create new project need to be prepared
   * also projectPublicKey, which is newly created account to store project data
   */
  async prepare(store) {
    await store.account.cache([
      {
        address: this.senderId,
      },
      {
        address: getAddressFromPublicKey(this.asset.projectPublicKey),
      },
      {
        address: getStateCenterAccount().address,
      },
    ]);
  }

  /**
   * Validation of asset
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
    if (!this.asset.title || typeof this.asset.title !== "string") {
      errors.push(
        new TransactionError(
          'Invalid "asset.title" defined on transaction',
          this.id,
          ".asset.title",
          this.asset.title,
          "Title must be string"
        )
      );
    }
    if (!this.asset.description || typeof this.asset.description !== "string") {
      errors.push(
        new TransactionError(
          'Invalid "asset.description" defined on transaction',
          this.id,
          ".asset.description",
          this.asset.description,
          "Description must be string"
        )
      );
    }
    if (!this.asset.category || typeof this.asset.category !== "string") {
      errors.push(
        new TransactionError(
          'Invalid "asset.category" defined on transaction',
          this.id,
          ".asset.category",
          this.asset.category,
          "Category must be string"
        )
      );
    }
    if (
      typeof this.asset.prize !== "string" ||
      utils.BigNum(this.asset.prize) < 0
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.prize" defined on transaction',
          this.id,
          ".asset.prize",
          this.asset.prize,
          "Prize must be valid string and greater or equal to zero"
        )
      );
    }
    if (typeof this.asset.maxTime !== "number" || this.asset.maxTime < 0) {
      errors.push(
        new TransactionError(
          'Invalid "asset.maxTime" defined on transaction',
          this.id,
          ".asset.maxTime",
          this.asset.maxTime,
          "maxTime must be valid number and greater or equal to zero"
        )
      );
    }
    if (
      typeof this.asset.maxRevision !== "number" ||
      this.asset.maxRevision < 0
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.maxRevision" defined on transaction',
          this.id,
          ".asset.maxRevision",
          this.asset.maxRevision,
          "maxRevision must be valid number and greater or equal to zero"
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
      const stateCenter = store_account_get(
        getStateCenterAccount().publicKey,
        store
      );
      if (Object.keys(projectAccount.asset).length != 0) {
        errors.push(
          new TransactionError(
            "Specified Project Account needs to be a fresh account, to be used as project data account",
            this.id,
            "projectAccount.asset",
            projectAccount.asset,
            "Account cant have any additional values"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(this.asset, "category") &&
        !stateCenter.asset.category.includes(this.asset.category)
      ) {
        errors.push(
          new TransactionError(
            "Category is unavailable",
            this.id,
            ".asset.category",
            this.asset.category,
            "Category needs to be known in stateCenter.asset.category"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type != ACCOUNT.EMPLOYER
      ) {
        errors.push(
          new TransactionError(
            "Sender must be an employer account",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type needs to be ${ACCOUNT.EMPLOYER}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(stateCenter.asset, "type") &&
        stateCenter.asset.type != ACCOUNT.STATE
      ) {
        errors.push(
          new TransactionError(
            "FATAL: configured account is not a state center account, check your configuration",
            this.id,
            "stateCenter.asset.type",
            stateCenter.asset.type,
            `Type should be ${ACCOUNT.STATE}`
          )
        );
      }
      if (
        utils
          .BigNum(this.asset.prize)
          .add(
            utils
              .BigNum(this.asset.prize)
              .mul(MISCELLANEOUS.EMPLOYER_REJECTION_PINALTY_PERCENTAGE)
              .round()
          )
          .sub(this.fee)
          .gt(sender.balance)
      ) {
        errors.push(
          new TransactionError(
            "Sender doesn't have enough balance to make new project",
            this.id,
            ".balance",
            sender.balance,
            "Balance should be minimum: " +
              utils
                .BigNum(this.asset.prize)
                .add(
                  utils
                    .BigNum(this.asset.prize)
                    .mul(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERCENTAGE)
                    .round()
                )
                .add(this.fee)
                .toString()
          )
        );
      }
      if (errors.length == 0) {
        const projectAsset = {
          type: ACCOUNT.PROJECT,
          employer: sender.address,
          title: this.asset.title,
          description: this.asset.description,
          category: this.asset.category,
          prize: this.asset.prize,
          freezedFund: this.asset.prize,
          freezedFee: utils
            .BigNum(this.asset.prize)
            .mul(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERCENTAGE)
            .round()
            .toString(),
          cashback: "0",
          maxTime: this.asset.maxTime,
          maxRevision: this.asset.maxRevision,
          status: STATUS.PROJECT.OPEN,
          statusNote: [],
          submission: [],
          winner: null,
          postedOn: this.timestamp,
          workStarted: null,
          workFinished: null,
          proposal: [],
          openedDisputes: [],
          closedDisputes: [],
          activity: [],
          commitmentFee: utils
            .BigNum(this.asset.prize)
            .mul(MISCELLANEOUS.LEADER_COMMITMENT_PERCENTAGE)
            .round()
            .toString(),
        };
        const stateAsset = {
          ...stateCenter.asset,
          available: {
            projects: [],
            ...stateCenter.asset.available,
          },
        };
        const senderAsset = {
          open: [],
          ...sender.asset,
        };
        senderAsset.open.unshift(projectAccount.publicKey);
        stateAsset.available.projects.unshift(projectAccount.publicKey);
        senderAsset.log.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
          value: utils
            .BigNum(0)
            .sub(projectAsset.freezedFund)
            .sub(projectAsset.freezedFee)
            .toString(),
        });
        senderAsset.spent = utils
          .BigNum(senderAsset.spent)
          .add(projectAsset.freezedFund)
          .add(projectAsset.freezedFee)
          .toString();
        store.account.set(sender.address, {
          ...sender,
          balance: utils
            .BigNum(sender.balance)
            .sub(projectAsset.freezedFund)
            .sub(projectAsset.freezedFee)
            .toString(),
          asset: senderAsset,
        });
        store.account.set(projectAccount.address, {
          ...projectAccount,
          asset: projectAsset,
        });
        store.account.set(stateCenter.address, {
          ...stateCenter,
          asset: stateAsset,
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
    const projectAccount = store_account_get(
      this.asset.projectPublicKey,
      store
    );
    const stateCenter = store_account_get(
      getStateCenterAccount().publicKey,
      store
    );
    const stateAsset = {
      ...stateCenter.asset,
      available: {
        projects: [],
        ...stateCenter.asset.available,
      },
    };
    const projectIndex = stateAsset.available.projects.indexOf(
      projectAccount.publicKey
    );
    if (projectIndex > -1) {
      stateAsset.available.projects.splice(projectIndex, 1);
    }
    const senderAsset = {
      open: [],
      ...sender.asset,
    };
    const userOpenIndex = senderAsset.open.indexOf(projectAccount.publicKey);
    if (userOpenIndex > -1) {
      senderAsset.open.splice(userOpenIndex, 1);
    }
    senderAsset.log.shift();
    senderAsset.spent = utils
      .BigNum(senderAsset.spent)
      .sub(projectAccount.asset.freezedFund)
      .sub(projectAccount.asset.freezedFee)
      .toString();
    store.account.set(sender.address, {
      ...sender,
      balance: utils
        .BigNum(sender.balance)
        .add(projectAccount.asset.freezedFund)
        .add(projectAccount.asset.freezedFee)
        .toString(),
      asset: senderAsset,
    });
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: null,
    });
    store.account.set(stateCenter.address, {
      ...stateCenter,
      asset: stateAsset,
    });
    return [];
  }
}

module.exports = PostProjectTransaction;
