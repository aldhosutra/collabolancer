const { getStateCenterAccount, store_account_get } = require("./utils");
const { category, ACCOUNT } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
} = require("@liskhq/lisk-transactions");

/**
 * this custom transaction create new address and register it as solver.
 * Solver have right to settle dispute by casting vote to party they believe stand on right side
 *
 * Asset Parameter:
 * {NO_ASSET}
 */
class RegisterSolverTransaction extends BaseTransaction {
  static get TYPE() {
    return 103;
  }

  /**
   * Set the `RegisterSolverTransaction` transaction FEE to 0 LSK (FREE).
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    // return `${10 ** 8}`; // (= 1 LSK)
    return `0`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   * In this case, sender account that will be registered as solver are stored
   * also state center account
   */
  async prepare(store) {
    await store.account.cache([
      {
        address: this.senderId,
      },
      {
        address: getStateCenterAccount().address,
      },
    ]);
  }

  /**
   * Validation of asset property to register as solver
   * in this case, account need to be fresh, with no asset before
   */
  validateAsset() {
    const errors = [];
    if (Object.keys(this.asset).length !== 0) {
      errors.push(
        new TransactionError(
          'Invalid "asset" length must be zero',
          this.id,
          ".asset",
          this.asset,
          "Asset needs to unsetted"
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
      const stateCenter = store_account_get(
        getStateCenterAccount().publicKey,
        store
      );
      if (Object.keys(sender.asset).length !== 0) {
        errors.push(
          new TransactionError(
            "Sender Account needs to be a fresh account",
            this.id,
            ".asset",
            sender.asset,
            "Account cant have any additional values"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(stateCenter.asset, "user") &&
        stateCenter.asset.user.solver.includes(sender.publicKey)
      ) {
        errors.push(
          new TransactionError(
            "Sender public key already exist in state center solver account",
            this.id,
            ".publicKey",
            sender.publicKey,
            "Sender public key must not exist in state center solver account"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(stateCenter.asset, "type") &&
        stateCenter.asset.type !== ACCOUNT.STATE
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
      if (errors.length === 0) {
        const newAsset = {
          type: ACCOUNT.SOLVER,
          win: 0,
          lose: 0,
          vote: [],
          earning: "0",
          log: [],
        };
        const stateAsset = {
          type: ACCOUNT.STATE,
          category: category.available,
          user: {
            employer: [],
            worker: [],
            solver: [],
            ...stateCenter.asset.user,
          },
          ...stateCenter.asset,
        };
        stateAsset.user.solver.unshift(sender.publicKey);
        store.account.set(sender.address, { ...sender, asset: newAsset });
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
    const stateCenter = store_account_get(
      getStateCenterAccount().publicKey,
      store
    );
    const stateAsset = {
      type: ACCOUNT.STATE,
      category: category.available,
      user: {
        employer: [],
        worker: [],
        solver: [],
        ...stateCenter.asset.user,
      },
      ...stateCenter.asset,
    };
    const solverIndex = stateAsset.user.solver.indexOf(sender.publicKey);
    if (solverIndex > -1) {
      stateAsset.user.solver.splice(solverIndex, 1);
    }
    store.account.set(sender.address, { ...sender, asset: null });
    store.account.set(stateCenter.address, {
      ...stateCenter,
      asset: stateAsset,
    });
    return [];
  }
}

module.exports = RegisterSolverTransaction;
