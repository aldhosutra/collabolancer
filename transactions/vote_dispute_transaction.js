// eslint-disable-next-line no-redeclare
/* global BigInt */

const { store_account_get } = require("./utils");
const { ACCOUNT, STATUS } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This transaction can only be executed by solver.
 * Solver will cast vote to concerned dispute, and pay some fee.
 *
 * Required:
 * this.asset.disputePublicKey
 * this.asset.voteFor
 */
class VoteDisputeTransaction extends BaseTransaction {
  static get TYPE() {
    return 117;
  }

  /**
   * Set the `VoteDisputeTransaction` transaction FEE to 0 LSK (FREE).
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    return `0`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   */
  async prepare(store) {
    await store.account.cache([
      {
        address: this.senderId,
      },
      {
        address: getAddressFromPublicKey(this.asset.disputePublicKey),
      },
    ]);
  }

  /**
   * Validation of asset property
   */
  validateAsset() {
    const errors = [];
    if (
      !this.asset.disputePublicKey ||
      typeof this.asset.disputePublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.disputePublicKey" defined on transaction',
          this.id,
          ".asset.disputePublicKey",
          this.asset.disputePublicKey,
          "disputePublicKey is required, and must be string"
        )
      );
    }
    if (
      !this.asset.voteFor ||
      typeof this.asset.voteFor !== "string" ||
      !["litigant", "defendant"].includes(this.asset.voteFor)
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.voteFor" defined on transaction',
          this.id,
          ".asset.voteFor",
          this.asset.voteFor,
          "voteFor is required, must be string, and must be either 'litigant' or 'defendant'"
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
      const disputeAccount = store_account_get(
        this.asset.disputePublicKey,
        store
      );
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type != ACCOUNT.SOLVER
      ) {
        errors.push(
          new TransactionError(
            "sender is not a Project Account",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type should be ${ACCOUNT.SOLVER}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(disputeAccount.asset, "type") &&
        disputeAccount.asset.type != ACCOUNT.DISPUTE
      ) {
        errors.push(
          new TransactionError(
            "sender is not a Project Account",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type should be ${ACCOUNT.SOLVER}`
          )
        );
      }
      if (disputeAccount.asset.status != STATUS.DISPUTE.OPEN) {
        errors.push(
          new TransactionError(
            `Dispute status is not ${STATUS.DISPUTE.OPEN}, therefore you can't cast a vote`,
            this.id,
            "disputeAccount.asset.status",
            disputeAccount.asset.status,
            `Status should be ${STATUS.DISPUTE.OPEN}`
          )
        );
      }
      if (
        disputeAccount.asset.vote.litigant.includes(sender.publicKey) ||
        disputeAccount.asset.vote.defendant.includes(sender.publicKey)
      ) {
        errors.push(
          new TransactionError(
            `This Solver already voted for this dispute`,
            this.id,
            "sender.address",
            sender.address,
            `Can't cast vote twice`
          )
        );
      }
      if (BigInt(disputeAccount.asset.castVoteFee) > BigInt(sender.balance)) {
        errors.push(
          new TransactionError(
            "Sender doesn't have enough balance to pay for vote fee",
            this.id,
            "sender.address",
            sender.balance,
            "Balance should be minimum: " +
              BigInt(disputeAccount.asset.castVoteFee).toString()
          )
        );
      }
      if (
        this.timestamp >
        disputeAccount.asset.timestamp + disputeAccount.asset.maxDays * 86400
      ) {
        errors.push(
          new TransactionError(
            "maxDays is passed, can't cast vote again",
            this.id,
            "this.timestamp",
            this.timestamp,
            `maxDays is passed ${
              disputeAccount.asset.timestamp +
              disputeAccount.asset.maxDays * 86400 -
              this.timestamp
            } seconds ago`
          )
        );
      }
      if (errors.length == 0) {
        const disputeAsset = disputeAccount.asset;
        disputeAsset.vote[this.asset.voteFor].unshift(sender.publicKey);
        store.account.set(disputeAccount.address, {
          ...disputeAccount,
          asset: disputeAsset,
        });
        const senderAsset = sender.asset;
        senderAsset.log.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
          value: utils.BigNum(0).sub(disputeAsset.castVoteFee).toString(),
        });
        senderAsset.earning = utils
          .BigNum(senderAsset.earning)
          .sub(disputeAsset.castVoteFee)
          .toString();
        senderAsset.vote.unshift(disputeAccount.publicKey);
        store.account.set(sender.address, {
          ...sender,
          balance: utils
            .BigNum(sender.balance)
            .sub(disputeAsset.castVoteFee)
            .toString(),
          asset: senderAsset,
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
    const disputeAccount = store_account_get(
      this.asset.disputePublicKey,
      store
    );
    const disputeAsset = disputeAccount.asset;
    const senderIndex = disputeAsset.vote[this.asset.voteFor].indexOf(
      sender.publicKey
    );
    if (senderIndex > -1) {
      disputeAsset.vote[this.asset.voteFor].splice(senderIndex, 1);
    }
    store.account.set(disputeAccount.address, {
      ...disputeAccount,
      asset: disputeAsset,
    });
    const senderAsset = sender.asset;
    senderAsset.log.shift();
    senderAsset.earning = utils
      .BigNum(senderAsset.earning)
      .add(disputeAsset.castVoteFee)
      .toString();
    const senderVoteIndex = senderAsset.vote.indexOf(disputeAccount.publicKey);
    if (senderVoteIndex > -1) {
      senderAsset.vote.splice(senderVoteIndex, 1);
    }
    store.account.set(sender.address, {
      ...sender,
      balance: utils
        .BigNum(sender.balance)
        .add(disputeAsset.castVoteFee)
        .toString(),
      asset: senderAsset,
    });
    return [];
  }
}

module.exports = VoteDisputeTransaction;
