// eslint-disable-next-line no-redeclare
/* global BigInt */

const { store_account_get } = require("./utils");
const { ACCOUNT, STATUS, MISCELLANEOUS } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by worker.
 * Purpose is to join / apply as team member
 *
 * Required:
 * this.asset.teamPublicKey [@fresh]
 * this.asset.proposalPublicKey
 * this.asset.role
 */
class JoinTeamTransaction extends BaseTransaction {
  static get TYPE() {
    return 106;
  }

  /**
   * Set the `JoinTeamTransaction` transaction FEE to 0.
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    return `0`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   * In this case, sender account as worker that wouold create new proposal for project
   * and teamPublicKey, that will be used to store team application data
   * also proposalPublicKey, which is proposal account to store team data
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
        address: getAddressFromPublicKey(this.asset.teamPublicKey),
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

    if (proposalAccount.asset.team.filter((el) => el !== 0).length > 0) {
      await store.account.cache({
        address_in: proposalAccount.asset.team
          .filter((el) => el !== 0)
          .map((item) => getAddressFromPublicKey(item)),
      });
    }
  }

  /**
   * Validation of asset property to register as worker
   * in this case, account need to be fresh, with no asset before
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
    if (typeof this.asset.role !== "number" || this.asset.role < 0) {
      errors.push(
        new TransactionError(
          'Invalid "asset.role" defined on transaction',
          this.id,
          ".asset.role",
          this.asset.role,
          "Role is required, and must be number greater or equal to 0"
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
      const teamAccount = store_account_get(this.asset.teamPublicKey, store);
      const projectAccount = store_account_get(
        proposalAccount.asset.project,
        store
      );
      const appliedTeams = [];
      proposalAccount.asset.team
        .filter((el) => el !== 0)
        .forEach((item) => {
          appliedTeams.push(store_account_get(item, store));
        });
      if (Object.keys(teamAccount.asset).length !== 0) {
        errors.push(
          new TransactionError(
            "Specified Team Account needs to be a fresh account, to be used as team application data account",
            this.id,
            "teamAccount.asset",
            teamAccount.asset,
            "Account cant have any additional values"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(proposalAccount.asset, "type") &&
        proposalAccount.asset.type !== ACCOUNT.PROPOSAL
      ) {
        errors.push(
          new TransactionError(
            "Specified proposalPublicKey Account is not a proposal account",
            this.id,
            "proposalAccount.asset.type",
            proposalAccount.asset.type,
            `Type needs to be ${ACCOUNT.PROPOSAL}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type !== ACCOUNT.WORKER
      ) {
        errors.push(
          new TransactionError(
            "Sender must be an worker account",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type needs to be ${ACCOUNT.WORKER}`
          )
        );
      }
      if (
        appliedTeams.map((item) => item.asset.worker).includes(sender.address)
      ) {
        errors.push(
          new TransactionError(
            "Sender must not have joined any team for this proposal",
            this.id,
            "sender.address",
            sender.address,
            `Sender address can't be exist in one of proposal joined team`
          )
        );
      }
      if (proposalAccount.asset.leader === sender.address) {
        errors.push(
          new TransactionError(
            "Leader can't apply as team member",
            this.id,
            "proposalAccount.asset.leader",
            proposalAccount.asset.leader,
            sender.address +
              " , that recorded as leader, cant apply as team member"
          )
        );
      }
      if (proposalAccount.asset.status !== STATUS.PROPOSAL.APPLIED) {
        errors.push(
          new TransactionError(
            `Proposal Status is not ${STATUS.PROPOSAL.APPLIED}, cant join as team anymore`,
            this.id,
            "proposalAccount.asset.status",
            proposalAccount.asset.status,
            `to join as team, proposal status must be ${STATUS.PROPOSAL.APPLIED}`
          )
        );
      }
      if (typeof proposalAccount.asset.team[this.asset.role] === "undefined") {
        errors.push(
          new TransactionError(
            "Role Index out of range",
            this.id,
            ".asset.role",
            this.asset.role,
            "role is undefined, check your data"
          )
        );
      }
      if (
        typeof proposalAccount.asset.team[this.asset.role] !== "undefined" &&
        proposalAccount.asset.team[this.asset.role] !== 0
      ) {
        errors.push(
          new TransactionError(
            "Role slot is already assigned",
            this.id,
            "proposalAccount.asset.team[this.asset.role]",
            proposalAccount.asset.team[this.asset.role],
            "This role should be 0, indicating that nobody assigned to this role"
          )
        );
      }
      if (
        BigInt(proposalAccount.asset.term.commitmentFee) >
        BigInt(sender.balance)
      ) {
        errors.push(
          new TransactionError(
            "Sender doesn't have enough balance to lock commitment fee",
            this.id,
            ".balance",
            sender.balance,
            "Balance should be minimum: " +
              BigInt(proposalAccount.asset.term.commitmentFee).toString()
          )
        );
      }
      if (errors.length === 0) {
        const teamAsset = {
          type: ACCOUNT.TEAM,
          role: proposalAccount.asset.term.roleList[this.asset.role],
          leader: proposalAccount.asset.leader,
          proposal: proposalAccount.publicKey,
          project: proposalAccount.asset.project,
          worker: sender.address,
          freezedFund: "0",
          freezedFee: "0",
          cashback: "0",
          potentialEarning: utils
            .BigNum(proposalAccount.asset.term.commitmentFee)
            .div(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
            .round()
            .toString(),
          contribution: [],
          statusNote: [],
          status: STATUS.TEAM.APPLIED,
          forceReject: false,
          forceCancel: false,
          guilty: false,
          lastSubmitted: null,
        };
        const proposalAsset = proposalAccount.asset;
        proposalAsset.freezedFee = utils
          .BigNum(proposalAsset.freezedFee)
          .add(proposalAccount.asset.term.commitmentFee)
          .toString();
        proposalAsset.team[this.asset.role] = teamAccount.publicKey;
        const senderAsset = {
          joined: [],
          ...sender.asset,
        };
        senderAsset.joined.unshift(proposalAccount.asset.project);
        const projectAsset = projectAccount.asset;
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        store.account.set(projectAccount.address, {
          ...projectAccount,
          asset: projectAsset,
        });
        senderAsset.log.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
          value: utils
            .BigNum(0)
            .sub(proposalAccount.asset.term.commitmentFee)
            .toString(),
        });
        senderAsset.earning = utils
          .BigNum(senderAsset.earning)
          .sub(proposalAccount.asset.term.commitmentFee)
          .toString();
        store.account.set(sender.address, {
          ...sender,
          balance: utils
            .BigNum(sender.balance)
            .sub(proposalAccount.asset.term.commitmentFee)
            .toString(),
          asset: senderAsset,
        });
        store.account.set(teamAccount.address, {
          ...teamAccount,
          asset: teamAsset,
        });
        store.account.set(proposalAccount.address, {
          ...proposalAccount,
          asset: proposalAsset,
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
    const teamAccount = store_account_get(this.asset.teamPublicKey, store);
    const projectAccount = store_account_get(
      proposalAccount.asset.project,
      store
    );
    const proposalAsset = proposalAccount.asset;
    proposalAsset.freezedFee = utils
      .BigNum(proposalAsset.freezedFee)
      .sub(proposalAccount.asset.term.commitmentFee)
      .toString();
    proposalAsset.team[this.asset.role] = 0;
    const senderAsset = {
      joined: [],
      ...sender.asset,
    };
    const joinedIndex = senderAsset.joined.indexOf(
      proposalAccount.asset.project
    );
    if (joinedIndex > -1) {
      senderAsset.joined.splice(joinedIndex, 1);
    }
    const projectAsset = projectAccount.asset;
    projectAsset.activity.shift();
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    senderAsset.log.shift();
    senderAsset.earning = utils
      .BigNum(senderAsset.earning)
      .add(proposalAccount.asset.term.commitmentFee)
      .toString();
    store.account.set(sender.address, {
      ...sender,
      balance: utils
        .BigNum(sender.balance)
        .add(proposalAccount.asset.term.commitmentFee)
        .toString(),
      asset: senderAsset,
    });
    store.account.set(teamAccount.address, {
      ...teamAccount,
      asset: null,
    });
    store.account.set(proposalAccount.address, {
      ...proposalAccount,
      asset: proposalAsset,
    });
    return [];
  }
}

module.exports = JoinTeamTransaction;
