const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const CONSTANTS = require("./constants.json");

/**
 * DEVELOPMENT PURPOSE ONLY
 * Faucet Transaction
 */
class FaucetTransaction extends BaseTransaction {
  static get TYPE() {
    return 999;
  }

  static get FEE() {
    return `0`;
  }

  async prepare(store) {
    await store.account.cache([
      {
        address: this.asset.recipientId,
      },
    ]);
  }

  validateAsset() {
    const errors = [];
    return errors;
  }

  applyAsset(store) {
    const errors = [];
    try {
      const account = store.account.getOrDefault(this.asset.recipientId);
      if (
        CONSTANTS.WHITELIST.length > 0 &&
        !CONSTANTS.WHITELIST.includes(this.asset.recipientId)
      ) {
        errors.push(
          new TransactionError(
            'Invalid "asset.recipientId" defined on transaction',
            this.id,
            ".asset.recipientId",
            this.asset.recipientId,
            "recipientId is not listed in Blockchain Whitelisted Faucet Recipient Address"
          )
        );
      }
      if (errors.length == 0) {
        store.account.set(account.address, {
          ...account,
          balance: utils
            .BigNum(account.balance)
            .add(this.asset.amount)
            .toString(),
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

  undoAsset(store) {
    const account = store.account.get(this.asset.recipientId);
    store.account.set(account.address, {
      ...account,
      balance: utils.BigNum(account.balance).sub(this.asset.amount).toString(),
    });
    return [];
  }
}

module.exports = { FaucetTransaction };
