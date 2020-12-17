// eslint-disable-next-line no-redeclare
/* global BigInt */

const { getStateCenterAccount, store_account_get } = require("./utils");
const { ACCOUNT, MISCELLANEOUS, STATUS } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * Dispute are in two forms, Leader vs Employer, and Team Member vs Leader.
 * So leader and member are the one who can execute this transaction.
 * Dispute mechanism are provided to be a way for solving issue regarding their work.
 * Dispute can be opened during freezed period (MISCELLANEOUS.FUND_FREEZED_PERIOD).
 * and will be available to vote for maxDays period, then can be closed
 *
 * Required:
 * this.asset.disputePublicKey [@fresh]
 * this.asset.casePublicKey
 * this.asset.projectPublicKey
 * this.asset.suit
 * this.asset.maxDays
 */
class OpenDisputeTransaction extends BaseTransaction {
  static get TYPE() {
    return 116;
  }

  /**
   * Set the `OpenDisputeTransaction` transaction FEE to 0 LSK (FREE).
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
        address: getStateCenterAccount().address,
      },
      {
        address: getAddressFromPublicKey(this.asset.casePublicKey),
      },
      {
        address: getAddressFromPublicKey(this.asset.disputePublicKey),
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

    const caseAccount = store.account.get(
      getAddressFromPublicKey(this.asset.casePublicKey)
    );
    if (caseAccount.asset.type === ACCOUNT.PROPOSAL) {
      await store.account.cache([
        {
          address: getAddressFromPublicKey(caseAccount.asset.project),
        },
      ]);
    } else if (caseAccount.asset.type === ACCOUNT.TEAM) {
      await store.account.cache([
        {
          address: getAddressFromPublicKey(caseAccount.asset.proposal),
        },
      ]);
    }
  }

  /**
   * Validation of asset property
   */
  validateAsset() {
    const errors = [];
    if (
      !this.asset.casePublicKey ||
      typeof this.asset.casePublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.casePublicKey" defined on transaction',
          this.id,
          ".asset.casePublicKey",
          this.asset.casePublicKey,
          "casePublicKey is required, and must be string"
        )
      );
    }
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
    if (!this.asset.suit || typeof this.asset.suit !== "string") {
      errors.push(
        new TransactionError(
          'Invalid "asset.suit" defined on transaction',
          this.id,
          ".asset.suit",
          this.asset.suit,
          "suit is required, and must be string"
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
      const projectAccount = store_account_get(
        this.asset.projectPublicKey,
        store
      );
      const proposalAccount = store_account_get(
        projectAccount.asset.winner,
        store
      );
      const caseAccount = store_account_get(this.asset.casePublicKey, store);
      const disputeAccount = store_account_get(
        this.asset.disputePublicKey,
        store
      );
      let disputeType,
        defendant,
        targetFundAccount,
        targetFundStatus,
        caseStatus,
        litigantFreezedFee,
        defendantFreezedFee;
      let caseAmount = 0;
      if (
        // Leader vs Employer type dispute
        caseAccount.asset.type === ACCOUNT.PROPOSAL &&
        // Scenario where leader already submitting their work, but employer always rejecting
        caseAccount.asset.status === STATUS.PROPOSAL.REJECTED &&
        [
          STATUS.PROJECT.REFUSED,
          STATUS.PROJECT.DISPUTED,
          STATUS.PROJECT.DISPUTE_CLOSED,
        ].includes(projectAccount.asset.status)
      ) {
        disputeType = MISCELLANEOUS.DISPUTE_TYPE.LEADER_VS_EMPLOYER;
        defendant = caseAccount.asset.employer;
        caseStatus = STATUS.PROPOSAL.DISPUTED;
        targetFundStatus = STATUS.PROJECT.DISPUTED;
        targetFundAccount = store_account_get(caseAccount.asset.project, store);
        caseAmount = targetFundAccount.asset.prize;
        litigantFreezedFee = targetFundAccount.asset.commitmentFee;
        defendantFreezedFee = utils
          .BigNum(targetFundAccount.asset.prize)
          .mul(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERCENTAGE)
          .round();
        defendantFreezedFee = utils
          .BigNum(defendantFreezedFee)
          .sub(
            utils
              .BigNum(defendantFreezedFee)
              .mul(MISCELLANEOUS.EMPLOYER_REJECTION_PINALTY_PERCENTAGE)
          )
          .round();
        if (caseAccount.asset.leader !== sender.address) {
          errors.push(
            new TransactionError(
              "You are not the leadear of this proposal account, you are not allowed to open disputes",
              this.id,
              "sender.address",
              sender.address,
              "owner is: " + caseAccount.asset.leader
            )
          );
        }
        if (projectAccount.asset.winner !== caseAccount.publicKey) {
          errors.push(
            new TransactionError(
              "this proposal case account is not associated with project account",
              this.id,
              "this.asset.casePublicKey",
              this.asset.casePublicKey,
              "Associated proposal account is: " + projectAccount.asset.winner
            )
          );
        }
      } else if (
        // Team vs Leader type dispute
        caseAccount.asset.type === ACCOUNT.TEAM &&
        // Scenario where team already submitting their work, but leader always rejecting, or employer is rejecting work while leader also reject team work
        caseAccount.asset.status === STATUS.TEAM.REJECTED &&
        caseAccount.asset.forceReject === false &&
        [STATUS.PROPOSAL.SUBMITTED, STATUS.PROPOSAL.DISPUTE_CLOSED].includes(
          proposalAccount.asset.status
        ) &&
        BigInt(proposalAccount.asset.freezedFund) >=
          BigInt(proposalAccount.asset.potentialEarning) &&
        [
          STATUS.PROJECT.FINISHED,
          STATUS.PROJECT.TERMINATED,
          STATUS.PROJECT.DISPUTED,
          STATUS.PROJECT.DISPUTE_CLOSED,
        ].includes(projectAccount.asset.status)
      ) {
        disputeType = MISCELLANEOUS.DISPUTE_TYPE.TEAM_VS_LEADER;
        defendant = caseAccount.asset.leader;
        caseStatus = STATUS.TEAM.DISPUTED;
        targetFundStatus = STATUS.PROPOSAL.DISPUTED;
        targetFundAccount = store_account_get(
          caseAccount.asset.proposal,
          store
        );
        caseAmount = caseAccount.asset.potentialEarning;
        litigantFreezedFee = targetFundAccount.asset.term.commitmentFee;
        defendantFreezedFee = projectAccount.asset.commitmentFee;
        if (caseAccount.asset.worker !== sender.address) {
          errors.push(
            new TransactionError(
              "You are not the worker of this team account, you are not allowed to open disputes",
              this.id,
              "sender.address",
              sender.address,
              "Worker is: " + caseAccount.asset.leader
            )
          );
        }
        if (caseAccount.asset.project !== projectAccount.publicKey) {
          errors.push(
            new TransactionError(
              "this team case account is not associated with project account",
              this.id,
              "this.asset.projectPublicKey",
              this.asset.projectPublicKey,
              "Associated project account is: " + caseAccount.asset.project
            )
          );
        }
      } else {
        errors.push(
          new TransactionError(
            "FATAL: Can't identify dispute type",
            this.id,
            "caseAccount.asset.type",
            caseAccount.asset.type,
            "Can't identify dispute type, check blockchain app configuration"
          )
        );
      }
      if (Object.keys(disputeAccount.asset).length !== 0) {
        errors.push(
          new TransactionError(
            "disputePublicKey Account needs to be a fresh account",
            this.id,
            ".asset.disputePublicKey",
            disputeAccount.asset,
            "disputePublicKey Account cant have any additional asset"
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(projectAccount.asset, "type") &&
        projectAccount.asset.type !== ACCOUNT.PROJECT
      ) {
        errors.push(
          new TransactionError(
            "projectPublicKey is not a Project Account",
            this.id,
            "projectAccount.asset.type",
            projectAccount.asset.type,
            `Type should be ${ACCOUNT.PROJECT}`
          )
        );
      }
      if (
        ![
          STATUS.PROJECT.FINISHED,
          STATUS.PROJECT.REFUSED,
          STATUS.PROJECT.TERMINATED,
          STATUS.PROJECT.DISPUTED,
          STATUS.PROJECT.DISPUTE_CLOSED,
        ].includes(projectAccount.asset.status)
      ) {
        errors.push(
          new TransactionError(
            `Project account status is not in ${[
              STATUS.PROJECT.FINISHED,
              STATUS.PROJECT.REFUSED,
              STATUS.PROJECT.TERMINATED,
              STATUS.PROJECT.DISPUTED,
              STATUS.PROJECT.DISPUTE_CLOSED,
            ].toString()}, therefore you can't open a dispute`,
            this.id,
            "projectAccount.asset.status",
            projectAccount.asset.status,
            `Status must be ${[
              STATUS.PROJECT.FINISHED,
              STATUS.PROJECT.REFUSED,
              STATUS.PROJECT.TERMINATED,
              STATUS.PROJECT.DISPUTED,
              STATUS.PROJECT.DISPUTE_CLOSED,
            ].toString()}`
          )
        );
      }
      if (
        projectAccount.asset.openedDisputes.includes(
          this.asset.disputePublicKey
        )
      ) {
        errors.push(
          new TransactionError(
            "Dispute Object public key already exist in Project account opened dispute registry",
            this.id,
            ".asset.disputePublicKey",
            this.asset.disputePublicKey,
            "Dispute Object already exist in projectAccount.asset.openedDisputes"
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
      if (
        Object.prototype.hasOwnProperty.call(stateCenter.asset, "available") &&
        Object.prototype.hasOwnProperty.call(
          stateCenter.asset.available,
          "disputes"
        ) &&
        stateCenter.asset.available.disputes.includes(
          this.asset.disputePublicKey
        )
      ) {
        errors.push(
          new TransactionError(
            "Dispute Object public key already exist in state center available dispute registry",
            this.id,
            ".asset.disputePublicKey",
            this.asset.disputePublicKey,
            "Dispute Object already exist in stateCenter.asset.available.disputes"
          )
        );
      }
      if (this.timestamp > projectAccount.asset.canBeClaimedOn) {
        errors.push(
          new TransactionError(
            "Fund Freezed Period is over, can't open dispute anymore",
            this.id,
            "this.timestamp",
            this.timestamp,
            `Limit to open dispute is, on: ${projectAccount.asset.canBeClaimedOn}`
          )
        );
      }
      if (
        !this.asset.maxDays ||
        typeof this.asset.maxDays !== "number" ||
        this.asset.maxDays >
          Math.max(
            MISCELLANEOUS.DISPUTE_MAXIMAL_OPEN_PERIOD,
            projectAccount.asset.maxTime
          )
      ) {
        errors.push(
          new TransactionError(
            'Invalid "asset.maxDays" defined on transaction',
            this.id,
            ".asset.maxDays",
            this.asset.maxDays,
            "maxDays must be valid number and not greater than " +
              Math.max(
                MISCELLANEOUS.DISPUTE_MAXIMAL_OPEN_PERIOD,
                projectAccount.asset.maxTime
              )
          )
        );
      }
      if (errors.length === 0) {
        let teamVsLeaderPinaltyPool = 0;
        const disputeAsset = {
          type: ACCOUNT.DISPUTE,
          disputeType: disputeType,
          timestamp: this.timestamp,
          maxDays: this.asset.maxDays,
          litigant: sender.address,
          defendant: defendant,
          project: projectAccount.publicKey,
          case: caseAccount.publicKey,
          caseType: caseAccount.asset.type,
          targetFundAccount: targetFundAccount.publicKey,
          targetFundAccountType: targetFundAccount.asset.type,
          suit: this.asset.suit,
          vote: {
            litigant: [],
            defendant: [],
          },
          score: {
            litigant: "0",
            defendant: "0",
          },
          winner: null,
          status: STATUS.DISPUTE.OPEN,
          freezedFund: utils
            .BigNum(caseAmount)
            .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
            .round()
            .toString(),
          litigantFreezedFee: utils
            .BigNum(litigantFreezedFee)
            .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
            .round()
            .toString(),
          defendantFreezedFee: utils
            .BigNum(defendantFreezedFee)
            .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
            .round()
            .toString(),
          castVoteFee: utils
            .BigNum(caseAmount)
            .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
            .mul(MISCELLANEOUS.DISPUTE_VOTE_FEE_PERCENTAGE)
            .round()
            .toString(),
        };

        const caseAsset = {
          ...caseAccount.asset,
          oldStatus: caseAccount.asset.status,
          status: caseStatus,
        };
        store.account.set(caseAccount.address, {
          ...caseAccount,
          asset: caseAsset,
        });

        let projectAsset;
        projectAsset = {
          ...projectAccount.asset,
          oldStatus: projectAccount.asset.status,
          status: STATUS.PROJECT.DISPUTED,
        };
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        if (disputeType === MISCELLANEOUS.DISPUTE_TYPE.TEAM_VS_LEADER) {
          teamVsLeaderPinaltyPool =
            targetFundAccount.asset.guilty === false
              ? targetFundAccount.asset.potentialEarning
              : 0;
          const targetFundAsset = {
            ...targetFundAccount.asset,
            oldStatus: targetFundAccount.asset.status,
            status: targetFundStatus,
            freezedFund: utils
              .BigNum(targetFundAccount.asset.freezedFund)
              .sub(
                utils
                  .BigNum(caseAmount)
                  .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
                  .round()
              )
              .sub(
                utils
                  .BigNum(teamVsLeaderPinaltyPool)
                  .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
                  .round()
              )
              .toString(),
            freezedFee: utils
              .BigNum(targetFundAccount.asset.freezedFee)
              .sub(
                utils
                  .BigNum(litigantFreezedFee)
                  .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
                  .round()
              )
              .sub(
                utils
                  .BigNum(defendantFreezedFee)
                  .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
                  .round()
              )
              .toString(),
          };
          disputeAsset.freezedFund = utils
            .BigNum(disputeAsset.freezedFund)
            .add(
              utils
                .BigNum(teamVsLeaderPinaltyPool)
                .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
                .round()
            )
            .toString();
          store.account.set(targetFundAccount.address, {
            ...targetFundAccount,
            asset: targetFundAsset,
          });
        } else if (
          disputeType === MISCELLANEOUS.DISPUTE_TYPE.LEADER_VS_EMPLOYER
        ) {
          // if disputeType is Leader vs Employer, then the targetFundAccount is a projectAccount
          // we don't want store.account.set to be executed twice for targetFundAccount and projectAccount
          projectAsset.freezedFund = utils
            .BigNum(projectAsset.freezedFund)
            .sub(
              utils
                .BigNum(projectAsset.prize)
                .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
                .round()
            )
            .toString();
          projectAsset.freezedFee = utils
            .BigNum(projectAsset.freezedFee)
            .sub(
              utils
                .BigNum(litigantFreezedFee)
                .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
                .round()
            )
            .sub(
              utils
                .BigNum(defendantFreezedFee)
                .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
                .round()
            )
            .toString();
        }
        projectAsset.openedDisputes.unshift(disputeAccount.publicKey);
        store.account.set(projectAccount.address, {
          ...projectAccount,
          asset: projectAsset,
        });

        const stateAsset = {
          ...stateCenter.asset,
          available: {
            disputes: [],
            ...stateCenter.asset.available,
          },
        };
        stateAsset.available.disputes.unshift(disputeAccount.publicKey);
        store.account.set(stateCenter.address, {
          ...stateCenter,
          asset: stateAsset,
        });

        store.account.set(disputeAccount.address, {
          ...disputeAccount,
          asset: disputeAsset,
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
    let teamVsLeaderPinaltyPool = 0;
    const stateCenter = store_account_get(
      getStateCenterAccount().publicKey,
      store
    );
    const projectAccount = store_account_get(
      this.asset.projectPublicKey,
      store
    );
    const caseAccount = store_account_get(this.asset.casePublicKey, store);
    const disputeAccount = store_account_get(
      this.asset.disputePublicKey,
      store
    );

    const oldDisputeAsset = disputeAccount.asset;
    store.account.set(disputeAccount.address, {
      ...disputeAccount,
      asset: null,
    });

    const caseAsset = {
      ...caseAccount.asset,
      status: caseAccount.asset.oldStatus,
    };
    delete caseAsset.oldStatus;
    store.account.set(caseAccount.address, {
      ...caseAccount,
      asset: caseAsset,
    });

    let projectAsset, caseAmount, litigantFreezedFee, defendantFreezedFee;
    projectAsset = {
      ...projectAccount.asset,
      status: projectAccount.asset.oldStatus,
    };
    projectAsset.activity.shift();
    delete projectAsset.oldStatus;
    if (
      oldDisputeAsset.disputeType === MISCELLANEOUS.DISPUTE_TYPE.TEAM_VS_LEADER
    ) {
      const targetFundAccount = store_account_get(
        caseAccount.asset.proposal,
        store
      );
      caseAmount = caseAccount.asset.potentialEarning;
      litigantFreezedFee = targetFundAccount.asset.term.commitmentFee;
      defendantFreezedFee = projectAccount.asset.commitmentFee;
      teamVsLeaderPinaltyPool =
        targetFundAccount.asset.guilty === false
          ? targetFundAccount.asset.potentialEarning
          : 0;
      const targetFundAsset = {
        ...targetFundAccount.asset,
        status: targetFundAccount.asset.oldStatus,
        freezedFund: utils
          .BigNum(targetFundAccount.asset.freezedFund)
          .add(
            utils
              .BigNum(caseAmount)
              .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
              .round()
          )
          .add(
            utils
              .BigNum(teamVsLeaderPinaltyPool)
              .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
              .round()
          )
          .toString(),
        freezedFee: utils
          .BigNum(targetFundAccount.asset.freezedFee)
          .add(
            utils
              .BigNum(litigantFreezedFee)
              .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
              .round()
          )
          .add(
            utils
              .BigNum(defendantFreezedFee)
              .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
              .round()
          )
          .toString(),
      };
      delete targetFundAsset.oldStatus;
      store.account.set(targetFundAccount.address, {
        ...targetFundAccount,
        asset: targetFundAsset,
      });
    } else if (
      oldDisputeAsset.disputeType ===
      MISCELLANEOUS.DISPUTE_TYPE.LEADER_VS_EMPLOYER
    ) {
      // if disputeType is Leader vs Employer, then the targetFundAccount is a projectAccount
      // we don't want store.account.set to be executed twice for targetFundAccount and projectAccount
      let oldEmployerFreezedFee;
      oldEmployerFreezedFee = utils
        .BigNum(projectAsset.prize)
        .mul(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERCENTAGE)
        .round();
      oldEmployerFreezedFee = utils
        .BigNum(oldEmployerFreezedFee)
        .sub(
          utils
            .BigNum(oldEmployerFreezedFee)
            .mul(MISCELLANEOUS.EMPLOYER_REJECTION_PINALTY_PERCENTAGE)
        )
        .round();
      caseAmount = projectAsset.prize;
      projectAsset.freezedFund = utils
        .BigNum(projectAsset.freezedFund)
        .add(
          utils
            .BigNum(projectAsset.prize)
            .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
            .round()
        )
        .toString();
      projectAsset.freezedFee = utils
        .BigNum(projectAsset.freezedFee)
        .add(
          utils
            .BigNum(projectAsset.commitmentFee)
            .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
            .round()
        )
        .add(
          utils
            .BigNum(oldEmployerFreezedFee)
            .mul(MISCELLANEOUS.DISPUTE_SEIZURE_PERCENTAGE)
            .round()
        )
        .toString();
    }
    const openedDisputeIndex = projectAsset.openedDisputes.indexOf(
      disputeAccount.publicKey
    );
    if (openedDisputeIndex > -1) {
      projectAsset.openedDisputes.splice(openedDisputeIndex, 1);
    }
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });

    const stateAsset = {
      available: {
        disputes: [],
        ...stateCenter.asset.available,
      },
      ...stateCenter.asset,
    };
    const disputeIndex = stateAsset.available.disputes.indexOf(
      disputeAccount.publicKey
    );
    if (disputeIndex > -1) {
      stateAsset.available.disputes.splice(disputeIndex, 1);
    }
    store.account.set(stateCenter.address, {
      ...stateCenter,
      asset: stateAsset,
    });
    return [];
  }
}

module.exports = OpenDisputeTransaction;
