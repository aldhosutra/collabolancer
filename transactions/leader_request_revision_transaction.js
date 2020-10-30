const { store_account_get } = require("./utils");
const { STATUS, ACCOUNT } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by team leader.
 * If leader doesn’t like the submitted files, they can make this transaction to request a revision.
 * After maximum revision are reached, concerned member will be rejected,
 * their locked fee will be distributed to all member, and their contribution is stopped
 *
 * Required:
 * this.asset.contributionPublicKey
 * this.asset.reason
 */
class LeaderRequestRevisionTransaction extends BaseTransaction {
  static get TYPE() {
    return 109;
  }

  /**
   * Set the `LeaderRequestRevisionTransaction` transaction FEE to 0.
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    return `0`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   * In this case, sender account as worker that wouold create new proposal for project
   * and proposalPublicKey, that will be used to create new proposal
   * also projectPublicKey, which is project account to push proposal data
   */
  async prepare(store) {
    await store.account.cache([
      {
        address: this.senderId,
      },
      {
        address: getAddressFromPublicKey(this.asset.contributionPublicKey),
      },
    ]);

    const contributionAccount = store.account.get(
      getAddressFromPublicKey(this.asset.contributionPublicKey)
    );
    await store.account.cache([
      {
        address: getAddressFromPublicKey(contributionAccount.asset.team),
      },
      {
        address: getAddressFromPublicKey(contributionAccount.asset.proposal),
      },
      {
        address: getAddressFromPublicKey(contributionAccount.asset.project),
      },
    ]);
  }

  /**
   * Validation of asset property
   */
  validateAsset() {
    const errors = [];
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
    if (!this.asset.reason || typeof this.asset.reason !== "string") {
      errors.push(
        new TransactionError(
          'Invalid "asset.reason" defined on transaction',
          this.id,
          ".asset.reason",
          this.asset.reason,
          "reason is required, and must be string"
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
      const contributionAccount = store_account_get(
        this.asset.contributionPublicKey,
        store
      );
      const proposalAccount = store_account_get(
        contributionAccount.asset.proposal,
        store
      );
      const teamAccount = store_account_get(
        contributionAccount.asset.team,
        store
      );
      const projectAccount = store_account_get(
        contributionAccount.asset.project,
        store
      );
      if (
        Object.prototype.hasOwnProperty.call(
          contributionAccount.asset,
          "type"
        ) &&
        contributionAccount.asset.type != ACCOUNT.CONTRIBUTION
      ) {
        errors.push(
          new TransactionError(
            "Specified contributionPublicKey is not a contribution account",
            this.id,
            "contributionAccount.asset.type",
            contributionAccount.asset.type,
            `Type needs to be ${ACCOUNT.CONTRIBUTION}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type != ACCOUNT.WORKER
      ) {
        errors.push(
          new TransactionError(
            "Sender is not a worker",
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
            "Sender is not a leader of current team associated with contribution",
            this.id,
            ".address",
            sender.address,
            "Leader is: " + proposalAccount.asset.leader
          )
        );
      }
      if (teamAccount.asset.status != STATUS.TEAM.SUBMITTED) {
        errors.push(
          new TransactionError(
            "contribution status is not yet submitted, doesnt make a sense to request revision",
            this.id,
            "teamAccount.asset.status",
            teamAccount.asset.status,
            `Status must be ${STATUS.TEAM.SUBMITTED}`
          )
        );
      }
      if (
        teamAccount.asset.statusNote.length !=
        teamAccount.asset.contribution.length - 1
      ) {
        errors.push(
          new TransactionError(
            "statusNote length and contribution length are not match",
            this.id,
            "teamAccount.asset.statusNote.length",
            teamAccount.asset.statusNote.length,
            "It must be teamAccount.asset.contribution.length - 1, which is: " +
              (teamAccount.asset.contribution.length - 1).toString()
          )
        );
      }
      if (errors.length == 0) {
        let reason;
        const projectAsset = projectAccount.asset;
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        const teamAsset = {
          statusNote: [],
          ...teamAccount.asset,
        };
        if (
          proposalAccount.asset.term.roleList.length > 0 &&
          proposalAccount.asset.term.maxRevision != null &&
          teamAccount.asset.contribution.length >=
            proposalAccount.asset.term.maxRevision
        ) {
          teamAsset.status = STATUS.TEAM.REJECTED;
          reason =
            "MAX REVISION EXCEEDED, your are out of this collaboration, your prize will be given to leader. Leader note: " +
            this.asset.reason;
          const proposalAsset = proposalAccount.asset;
          proposalAsset.freezedFund = utils
            .BigNum(proposalAsset.freezedFund)
            .add(teamAsset.potentialEarning)
            .toString();
          store.account.set(proposalAccount.address, {
            ...proposalAccount,
            asset: proposalAsset,
          });
        } else {
          teamAsset.status = STATUS.TEAM.REQUEST_REVISION;
          reason = this.asset.reason;
          projectAsset.freezedFund = utils
            .BigNum(projectAsset.freezedFund)
            .add(teamAsset.potentialEarning)
            .toString();
        }
        const proposalAsset = proposalAccount.asset;
        proposalAsset.freezedFee = utils
          .BigNum(proposalAsset.freezedFee)
          .add(proposalAsset.term.commitmentFee)
          .toString();
        teamAsset.freezedFund = utils
          .BigNum(teamAsset.freezedFund)
          .sub(teamAsset.potentialEarning)
          .toString();
        teamAsset.freezedFee = utils
          .BigNum(teamAsset.freezedFee)
          .sub(proposalAsset.term.commitmentFee)
          .toString();
        teamAsset.statusNote.unshift({
          time: this.timestamp,
          status: teamAsset.status,
          contribution: contributionAccount.publicKey,
          reason: reason,
        });
        store.account.set(proposalAccount.address, {
          ...proposalAccount,
          asset: proposalAsset,
        });
        store.account.set(projectAccount.address, {
          ...projectAccount,
          asset: projectAsset,
        });
        store.account.set(teamAccount.address, {
          ...teamAccount,
          asset: teamAsset,
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
    const contributionAccount = store_account_get(
      this.asset.contributionPublicKey,
      store
    );
    const proposalAccount = store_account_get(
      contributionAccount.asset.proposal,
      store
    );
    const teamAccount = store_account_get(
      contributionAccount.asset.team,
      store
    );
    const projectAccount = store_account_get(
      contributionAccount.asset.project,
      store
    );
    const teamAsset = {
      statusNote: [],
      ...teamAccount.asset,
      status: STATUS.TEAM.SUBMITTED,
    };
    const projectAsset = projectAccount.asset;
    projectAsset.activity.shift();
    if (teamAccount.asset.status == STATUS.TEAM.REJECTED) {
      const proposalAsset = proposalAccount.asset;
      proposalAsset.freezedFund = utils
        .BigNum(proposalAsset.freezedFund)
        .sub(teamAsset.potentialEarning)
        .toString();
      store.account.set(proposalAccount.address, {
        ...proposalAccount,
        asset: proposalAsset,
      });
    } else if (teamAccount.asset.status == STATUS.TEAM.REQUEST_REVISION) {
      projectAsset.freezedFund = utils
        .BigNum(projectAsset.freezedFund)
        .sub(teamAsset.potentialEarning)
        .toString();
    }
    const proposalAsset = proposalAccount.asset;
    proposalAsset.freezedFee = utils
      .BigNum(proposalAsset.freezedFee)
      .sub(proposalAsset.term.commitmentFee)
      .toString();
    teamAsset.freezedFund = utils
      .BigNum(teamAsset.freezedFund)
      .add(teamAsset.potentialEarning)
      .toString();
    teamAsset.freezedFee = utils
      .BigNum(teamAsset.freezedFee)
      .add(proposalAsset.term.commitmentFee)
      .toString();
    const statusNoteIndex = teamAsset.statusNote
      .map(function (e) {
        return e.contribution;
      })
      .indexOf(contributionAccount.publicKey);
    if (statusNoteIndex > -1) {
      teamAsset.statusNote.splice(statusNoteIndex, 1);
    }
    store.account.set(proposalAccount.address, {
      ...proposalAccount,
      asset: proposalAsset,
    });
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    store.account.set(teamAccount.address, {
      ...teamAccount,
      asset: teamAsset,
    });
    return [];
  }
}

module.exports = LeaderRequestRevisionTransaction;
