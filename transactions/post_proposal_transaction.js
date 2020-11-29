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
 * Purpose is to make a new proposal and become project leader.
 * This proposal can be set to enable collaboration, as well as set solo proposal.
 * Worker need to pay some locked fee, to incentivize collaboration,
 * so instead of competing with other worker, its more engaging to collaborate, and evade large locking fee.
 *
 * Required Parameter:
 * this.asset.proposalPublicKey [@fresh]
 * this.asset.projectPublicKey
 * this.asset.pitching
 * this.asset.term.roleList (if length > 0, then create colaboration mode)
 *
 * Collaboration Mode Parameter:
 * this.asset.term.brief
 * this.asset.term.maxTime
 * this.asset.term.maxRevision
 * this.asset.term.distribution.mode
 * this.asset.term.distribution.value
 */
class PostProposalTransaction extends BaseTransaction {
  static get TYPE() {
    return 105;
  }

  /**
   * Set the `PostProposalTransaction` transaction FEE to 0.1.
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    return `${utils.convertLSKToBeddows("0.1")}`;
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
        address: getAddressFromPublicKey(this.asset.projectPublicKey),
      },
      {
        address: getAddressFromPublicKey(this.asset.proposalPublicKey),
      },
    ]);

    const projectAccount = store.account.get(
      getAddressFromPublicKey(this.asset.projectPublicKey)
    );
    if (projectAccount.asset.proposal.length > 0) {
      await store.account.cache({
        address_in: projectAccount.asset.proposal.map((item) =>
          getAddressFromPublicKey(item)
        ),
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
    if (!this.asset.pitching || typeof this.asset.pitching !== "string") {
      errors.push(
        new TransactionError(
          'Invalid "asset.pitching" defined on transaction',
          this.id,
          ".asset.pitching",
          this.asset.pitching,
          "pitching is required, and must be string"
        )
      );
    }
    if (!this.asset.term.roleList || !Array.isArray(this.asset.term.roleList)) {
      errors.push(
        new TransactionError(
          'Invalid "asset.term.roleList" defined on transaction',
          this.id,
          ".asset.term.roleList",
          this.asset.term.roleList,
          "term.roleList must be Array"
        )
      );
    }
    if (
      this.asset.term.roleList.length != 0 &&
      (!this.asset.term.brief || typeof this.asset.term.brief !== "string")
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.term.brief" defined on transaction',
          this.id,
          ".asset.term.brief",
          this.asset.term.brief,
          "Term.brief is required in collaboration mode, and must be string"
        )
      );
    }
    if (
      this.asset.term.roleList.length != 0 &&
      (typeof this.asset.term.maxTime !== "number" ||
        this.asset.term.maxTime < 0)
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.term.maxTime" defined on transaction',
          this.id,
          ".asset.term.maxTime",
          this.asset.term.maxTime,
          "term.maxTime is required in collaboration mode, must be valid number and greater or equal to zero"
        )
      );
    }
    if (
      this.asset.term.roleList.length != 0 &&
      (typeof this.asset.term.maxRevision !== "number" ||
        this.asset.term.maxRevision < 0)
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.term.maxRevision" defined on transaction',
          this.id,
          ".asset.term.maxRevision",
          this.asset.term.maxRevision,
          "term.maxRevision is required in collaboration mode, must be valid number and greater or equal to zero"
        )
      );
    }
    if (
      this.asset.term.roleList.length != 0 &&
      (!this.asset.term.distribution.mode ||
        typeof this.asset.term.distribution.mode !== "string" ||
        !Object.values(MISCELLANEOUS.DISTRIBUTION).includes(
          this.asset.term.distribution.mode
        ))
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.term.distribution.mode" defined on transaction',
          this.id,
          ".asset.term.distribution.mode",
          this.asset.term.distribution.mode,
          `term.distribution.mode is required in collaboration mode, must be string in ${Object.values(
            MISCELLANEOUS.DISTRIBUTION
          ).toString()}`
        )
      );
    }
    if (
      this.asset.term.roleList.length != 0 &&
      this.asset.term.distribution.mode ==
        MISCELLANEOUS.DISTRIBUTION.LEADER_FIRST &&
      (!this.asset.term.distribution.value ||
        typeof this.asset.term.distribution.value !== "number" ||
        this.asset.term.distribution.value < 0 ||
        this.asset.term.distribution.value > 100)
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.term.distribution.value" defined on transaction',
          this.id,
          ".asset.term.distribution.value",
          this.asset.term.distribution.value,
          "term.distribution.value is required in collaboration mode leader-first distribution, and must be valid number and beetween 0-100"
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
        this.asset.proposalPublicKey,
        store
      );
      const appliedProposalList = [];
      projectAccount.asset.proposal.forEach((item) => {
        appliedProposalList.push(store_account_get(item, store));
      });
      if (Object.keys(proposalAccount.asset).length != 0) {
        errors.push(
          new TransactionError(
            "Specified Proposal Account needs to be a fresh account, to be used as proposal data account",
            this.id,
            "proposalAccount.asset",
            proposalAccount.asset,
            "Account cant have any additional values"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(projectAccount.asset, "type") &&
        projectAccount.asset.type != ACCOUNT.PROJECT
      ) {
        errors.push(
          new TransactionError(
            "Specified projectPublicKey Account is not a project account",
            this.id,
            "projectAccount.asset.type",
            projectAccount.asset.type,
            `Type needs to be ${ACCOUNT.PROJECT}`
          )
        );
      }
      if (projectAccount.asset.status != STATUS.PROJECT.OPEN) {
        errors.push(
          new TransactionError(
            "Project status is not open, therefore can't post any proposal",
            this.id,
            "projectAccount.asset.status",
            projectAccount.asset.status,
            `Status must be ${STATUS.PROJECT.OPEN}`
          )
        );
      }
      if (
        this.asset.term.roleList.length != 0 &&
        (!this.asset.term.maxTime ||
          typeof this.asset.term.maxTime !== "number") &&
        projectAccount.asset.maxTime - this.asset.term.maxTime <
          MISCELLANEOUS.MINIMAL_PROPOSAL_PROJECT_MAXTIME_DIFF
      ) {
        errors.push(
          new TransactionError(
            'Invalid "asset.term.maxTime" defined on transaction',
            this.id,
            ".asset.term.maxTime",
            this.asset.term.maxTime,
            `Minimum Difference between Proposal maxTime and Project maxTime is: ${MISCELLANEOUS.MINIMAL_PROPOSAL_PROJECT_MAXTIME_DIFF}, can't be lower than that`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type != ACCOUNT.WORKER
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
        appliedProposalList
          .map((item) => item.asset.leader)
          .includes(sender.address)
      ) {
        errors.push(
          new TransactionError(
            "Sender must not have applied any proposal for this project",
            this.id,
            "sender.address",
            sender.address,
            `Sender address can't be exist in one of project applied proposal`
          )
        );
      }
      if (
        BigInt(projectAccount.asset.commitmentFee) - BigInt(this.fee) >
        BigInt(sender.balance)
      ) {
        errors.push(
          new TransactionError(
            "Sender doesn't have enough balance to lock commitment fee",
            this.id,
            ".balance",
            sender.balance,
            "Balance should be minimum: " +
              (
                BigInt(projectAccount.asset.commitmentFee) - BigInt(this.fee)
              ).toString()
          )
        );
      }
      if (errors.length == 0) {
        const proposalAsset = {
          type: ACCOUNT.PROPOSAL,
          project: projectAccount.publicKey,
          employer: projectAccount.asset.employer,
          leader: sender.address,
          term: {
            commitmentFee: "0",
            roleList: this.asset.term.roleList,
            brief:
              typeof this.asset.term.brief !== "undefined" &&
              this.asset.term.roleList.length != 0
                ? this.asset.term.brief
                : null,
            maxTime:
              typeof this.asset.term.maxTime !== "undefined" &&
              this.asset.term.roleList.length != 0
                ? this.asset.term.maxTime
                : null,
            maxRevision:
              typeof this.asset.term.maxRevision !== "undefined" &&
              this.asset.term.roleList.length != 0
                ? this.asset.term.maxRevision
                : null,
            distribution: {
              mode:
                typeof this.asset.term.distribution.mode !== "undefined" &&
                this.asset.term.roleList.length != 0
                  ? this.asset.term.distribution.mode
                  : MISCELLANEOUS.DISTRIBUTION.ALL_EQUAL,
              value:
                typeof this.asset.term.distribution.value !== "undefined" &&
                this.asset.term.roleList.length != 0
                  ? this.asset.term.distribution.value
                  : 100,
            },
          },
          status: STATUS.PROPOSAL.APPLIED,
          guilty: false,
          potentialEarning: "0",
          freezedFund: "0",
          freezedFee: "0",
          cashback: "0",
          pitching: this.asset.pitching,
          lastSubmitted: null,
          team: this.asset.term.roleList.map(() => 0),
        };
        if (
          proposalAsset.term.roleList.length != 0 &&
          proposalAsset.term.distribution.mode ==
            MISCELLANEOUS.DISTRIBUTION.ALL_EQUAL
        ) {
          proposalAsset.term.distribution.value =
            100 / (proposalAsset.term.roleList.length + 1);
        }
        const leaderPortion = utils
          .BigNum(projectAccount.asset.prize)
          .mul(
            parseFloat(proposalAsset.term.distribution.value / 100).toFixed(15)
          )
          .round();
        proposalAsset.potentialEarning = utils
          .BigNum(leaderPortion)
          .round()
          .toString();
        if (
          proposalAsset.term.roleList.length != 0 &&
          proposalAsset.term.distribution.mode ==
            MISCELLANEOUS.DISTRIBUTION.ALL_EQUAL
        ) {
          proposalAsset.term.commitmentFee = utils
            .BigNum(leaderPortion)
            .mul(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
            .round()
            .toString();
        } else if (
          proposalAsset.term.roleList.length != 0 &&
          proposalAsset.term.distribution.mode ==
            MISCELLANEOUS.DISTRIBUTION.LEADER_FIRST
        ) {
          proposalAsset.term.commitmentFee = utils
            .BigNum(projectAccount.asset.prize)
            .sub(leaderPortion)
            .div(proposalAsset.term.roleList.length)
            .mul(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
            .round()
            .toString();
        }
        const projectAsset = projectAccount.asset;
        projectAsset.freezedFee = utils
          .BigNum(projectAsset.freezedFee)
          .add(projectAsset.commitmentFee)
          .toString();
        projectAsset.proposal.unshift(proposalAccount.publicKey);
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        const senderAsset = {
          joined: [],
          ...sender.asset,
        };
        senderAsset.joined.unshift(projectAccount.publicKey);
        senderAsset.log.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
          value: utils.BigNum(0).sub(projectAsset.commitmentFee).toString(),
        });
        senderAsset.earning = utils
          .BigNum(senderAsset.earning)
          .sub(projectAsset.commitmentFee)
          .toString();
        store.account.set(sender.address, {
          ...sender,
          balance: utils
            .BigNum(sender.balance)
            .sub(projectAsset.commitmentFee)
            .toString(),
          asset: senderAsset,
        });
        store.account.set(projectAccount.address, {
          ...projectAccount,
          asset: projectAsset,
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
    const projectAccount = store_account_get(
      this.asset.projectPublicKey,
      store
    );
    const proposalAccount = store_account_get(
      this.asset.proposalPublicKey,
      store
    );
    const projectAsset = {
      proposal: [],
      ...projectAccount.asset,
    };
    projectAsset.freezedFee = utils
      .BigNum(projectAsset.freezedFee)
      .sub(projectAsset.commitmentFee)
      .toString();
    const projectIndex = projectAsset.proposal.indexOf(
      proposalAccount.publicKey
    );
    if (projectIndex > -1) {
      projectAsset.proposal.splice(projectIndex, 1);
    }
    projectAsset.activity.shift();
    const senderAsset = {
      joined: [],
      ...sender.asset,
    };
    const joinedIndex = senderAsset.joined.indexOf(projectAccount.publicKey);
    if (joinedIndex > -1) {
      senderAsset.joined.splice(joinedIndex, 1);
    }
    senderAsset.log.shift();
    senderAsset.earning = utils
      .BigNum(senderAsset.earning)
      .add(projectAsset.commitmentFee)
      .toString();
    store.account.set(sender.address, {
      ...sender,
      balance: utils
        .BigNum(sender.balance)
        .add(projectAsset.commitmentFee)
        .toString(),
      asset: senderAsset,
    });
    store.account.set(proposalAccount.address, {
      ...proposalAccount,
      asset: null,
    });
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    return [];
  }
}

module.exports = PostProposalTransaction;
