const { store_account_get } = require("./utils");
const { STATUS, ACCOUNT, MISCELLANEOUS } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by project owner (employer).
 * If owner doesn’t like the submitted files, they can make this transaction to request a revision.
 * After maximum revision are reached, project status will be automatically finished and working will be cancelled.
 * Prize will not be distributed.
 *
 * Required:
 * this.asset.submissionPublicKey
 * this.asset.reason
 */
class EmployerRequestRevisionTransaction extends BaseTransaction {
  static get TYPE() {
    return 111;
  }

  /**
   * Set the `EmployerRequestRevisionTransaction` transaction FEE to 0.
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
        address: getAddressFromPublicKey(this.asset.submissionPublicKey),
      },
    ]);

    const submissionAccount = store.account.get(
      getAddressFromPublicKey(this.asset.submissionPublicKey)
    );
    await store.account.cache([
      {
        address: getAddressFromPublicKey(submissionAccount.asset.project),
      },
      {
        address: getAddressFromPublicKey(submissionAccount.asset.proposal),
      },
    ]);

    const proposalAccount = store.account.get(
      getAddressFromPublicKey(submissionAccount.asset.proposal)
    );
    const teamAddressList = proposalAccount.asset.team
      .filter((el) => el !== 0)
      .map((data) => getAddressFromPublicKey(data));
    if (teamAddressList.length > 0) {
      await store.account.cache({
        address_in: teamAddressList,
      });
    }
  }

  /**
   * Validation of asset property
   */
  validateAsset() {
    const errors = [];
    if (
      !this.asset.submissionPublicKey ||
      typeof this.asset.submissionPublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.submissionPublicKey" defined on transaction',
          this.id,
          ".asset.submissionPublicKey",
          this.asset.submissionPublicKey,
          "submissionPublicKey is required, and must be string"
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
      const submissionAccount = store_account_get(
        this.asset.submissionPublicKey,
        store
      );
      const proposalAccount = store_account_get(
        submissionAccount.asset.proposal,
        store
      );
      const projectAccount = store_account_get(
        submissionAccount.asset.project,
        store
      );
      let teamAccounts = [];
      proposalAccount.asset.team
        .filter((el) => el !== 0)
        .forEach((item) => {
          teamAccounts.push(store_account_get(item, store));
        });
      if (
        Object.prototype.hasOwnProperty.call(submissionAccount.asset, "type") &&
        submissionAccount.asset.type !== ACCOUNT.SUBMISSION
      ) {
        errors.push(
          new TransactionError(
            "Specified submissionPublicKey is not a submission account",
            this.id,
            ".asset.submissionPublicKey",
            submissionAccount.asset.type,
            `Type needs to be ${ACCOUNT.SUBMISSION}`
          )
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type !== ACCOUNT.EMPLOYER
      ) {
        errors.push(
          new TransactionError(
            "Sender is not a employer",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type needs to be ${ACCOUNT.EMPLOYER}`
          )
        );
      }
      if (projectAccount.asset.employer !== sender.address) {
        errors.push(
          new TransactionError(
            "Sender is not a employer of current project associated with submission",
            this.id,
            "sender.address",
            sender.address,
            "Employer is: " + projectAccount.asset.employer
          )
        );
      }
      if (proposalAccount.asset.status !== STATUS.PROPOSAL.SUBMITTED) {
        errors.push(
          new TransactionError(
            "proposal status is not yet submitted, doesnt make a sense to request revision",
            this.id,
            "proposalAccount.asset.status",
            proposalAccount.asset.status,
            `Status must be ${STATUS.PROPOSAL.SUBMITTED}`
          )
        );
      }
      if (projectAccount.asset.status !== STATUS.PROJECT.SUBMITTED) {
        errors.push(
          new TransactionError(
            "project status is not yet submitted, doesnt make a sense to request revision",
            this.id,
            ".asset.status",
            projectAccount.asset.status,
            `Status must be ${STATUS.PROJECT.SUBMITTED}`
          )
        );
      }
      if (
        projectAccount.asset.statusNote.length !==
        projectAccount.asset.submission.length - 1
      ) {
        errors.push(
          new TransactionError(
            "statusNote length and submission length are not match",
            this.id,
            ".asset.statusNote.length",
            projectAccount.asset.statusNote.length,
            "It must be projectAccount.asset.submission.length - 1, which is: " +
              (projectAccount.asset.submission.length - 1).toString()
          )
        );
      }
      if (errors.length === 0) {
        let teamReason, reason, forceReject, teamStatus;
        let employerRejectionPinalty = 0;
        const projectAsset = {
          statusNote: [],
          ...projectAccount.asset,
        };
        const proposalAsset = {
          ...proposalAccount.asset,
        };
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        projectAsset.freezedFund = utils
          .BigNum(projectAsset.freezedFund)
          .add(proposalAsset.potentialEarning)
          .toString();
        projectAsset.freezedFee = utils
          .BigNum(projectAsset.freezedFee)
          .add(projectAsset.commitmentFee)
          .toString();
        const pinaltyDivider =
          proposalAsset.team.filter((el) => el !== 0).length + 1;
        proposalAsset.freezedFund = utils
          .BigNum(proposalAsset.freezedFund)
          .sub(proposalAsset.potentialEarning)
          .toString();
        proposalAsset.freezedFee = utils
          .BigNum(proposalAsset.freezedFee)
          .sub(projectAsset.commitmentFee)
          .toString();
        proposalAsset.term.maxRevision += 1;
        if (
          (projectAccount.asset.maxRevision !== null &&
            projectAccount.asset.submission.length >=
              projectAccount.asset.maxRevision) ||
          this.timestamp >
            projectAccount.asset.workStarted +
              projectAccount.asset.maxTime * 86400
        ) {
          projectAsset.status = STATUS.PROJECT.REJECTED;
          proposalAsset.status = STATUS.PROPOSAL.REJECTED;
          teamStatus = STATUS.TEAM.REJECTED;
          forceReject = true;
          let reasonPrefix =
            this.timestamp >
            projectAccount.asset.workStarted +
              projectAccount.asset.maxTime * 86400
              ? "TIMEOUT REJECTION"
              : "MAX REVISION EXCEEDED";
          reason =
            reasonPrefix +
            ", your work are rejected, employer note: " +
            this.asset.reason;
          teamReason = `Employer Reject Submission, so your contribution also rejected. Employer note: ${this.asset.reason}`;
          employerRejectionPinalty = utils
            .BigNum(
              utils
                .BigNum(projectAsset.prize)
                .mul(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERCENTAGE)
                .round()
            )
            .mul(MISCELLANEOUS.EMPLOYER_REJECTION_PINALTY_PERCENTAGE)
            .round();
          projectAsset.freezedFee = utils
            .BigNum(projectAsset.freezedFee)
            .sub(employerRejectionPinalty)
            .toString();
        } else {
          projectAsset.status = STATUS.PROJECT.REQUEST_REVISION;
          proposalAsset.status = STATUS.PROPOSAL.REQUEST_REVISION;
          teamStatus = STATUS.TEAM.REQUEST_REVISION;
          forceReject = false;
          reason = this.asset.reason;
          teamReason = `Employer Request Revision for your leader's work, so your contribution also been requested for revision, maxRevision has been increased for your opportunity to resubmit revised version. Employer note: ${this.asset.reason}`;
        }
        teamAccounts.forEach((team) => {
          const teamAsset = {
            ...team.asset,
            oldStatus: team.asset.status,
          };
          if (team.asset.status === STATUS.TEAM.REJECTED) {
            proposalAsset.freezedFund = utils
              .BigNum(proposalAsset.freezedFund)
              .sub(teamAsset.potentialEarning)
              .toString();
            projectAsset.freezedFund = utils
              .BigNum(projectAsset.freezedFund)
              .add(teamAsset.potentialEarning)
              .toString();
          } else if (team.asset.status === STATUS.TEAM.SUBMITTED) {
            if (teamStatus === STATUS.TEAM.REQUEST_REVISION) {
              proposalAsset.freezedFee = utils
                .BigNum(proposalAsset.freezedFee)
                .add(proposalAsset.term.commitmentFee)
                .toString();
              teamAsset.freezedFee = utils
                .BigNum(teamAsset.freezedFee)
                .sub(proposalAsset.term.commitmentFee)
                .toString();
            }
            teamAsset.status = teamStatus;
            teamAsset.forceReject = forceReject;
            teamAsset.freezedFund = utils
              .BigNum(teamAsset.freezedFund)
              .sub(teamAsset.potentialEarning)
              .toString();
            projectAsset.freezedFund = utils
              .BigNum(projectAsset.freezedFund)
              .add(teamAsset.potentialEarning)
              .toString();
            teamAsset.statusNote.unshift({
              time: this.timestamp,
              status: teamStatus,
              contribution: forceReject
                ? "forceReject"
                : teamAsset.contribution[0],
              reason: teamReason,
            });
          } else if (
            [STATUS.TEAM.REQUEST_REVISION, STATUS.TEAM.SELECTED].includes(
              team.asset.status
            ) &&
            teamStatus === STATUS.TEAM.REJECTED
          ) {
            teamAsset.status = teamStatus;
            teamAsset.forceReject = forceReject;
            teamAsset.statusNote.unshift({
              time: this.timestamp,
              status: teamStatus,
              contribution: forceReject
                ? "forceReject"
                : teamAsset.contribution[0],
              reason: teamReason,
            });
          }
          teamAsset.freezedFund = utils
            .BigNum(teamAsset.freezedFund)
            .add(utils.BigNum(employerRejectionPinalty).div(pinaltyDivider))
            .round()
            .toString();
          store.account.set(team.address, {
            ...team,
            asset: teamAsset,
          });
        });
        proposalAsset.freezedFund = utils
          .BigNum(proposalAsset.freezedFund)
          .add(utils.BigNum(employerRejectionPinalty).div(pinaltyDivider))
          .round()
          .toString();
        projectAsset.statusNote.unshift({
          time: this.timestamp,
          status: projectAsset.status,
          submission: submissionAccount.publicKey,
          reason: reason,
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
    let employerRejectionPinalty = 0;
    const submissionAccount = store_account_get(
      this.asset.submissionPublicKey,
      store
    );
    const proposalAccount = store_account_get(
      submissionAccount.asset.proposal,
      store
    );
    const projectAccount = store_account_get(
      submissionAccount.asset.project,
      store
    );
    let teamAccounts = [];
    proposalAccount.asset.team
      .filter((el) => el !== 0)
      .forEach((item) => {
        teamAccounts.push(store_account_get(item, store));
      });
    const projectAsset = {
      statusNote: [],
      ...projectAccount.asset,
      status: STATUS.PROJECT.SUBMITTED,
    };
    const proposalAsset = {
      ...proposalAccount.asset,
      status: STATUS.PROPOSAL.SUBMITTED,
    };
    const pinaltyDivider =
      proposalAsset.team.filter((el) => el !== 0).length + 1;
    if (projectAccount.asset.status === STATUS.PROJECT.REJECTED) {
      employerRejectionPinalty = utils
        .BigNum(
          utils
            .BigNum(projectAsset.prize)
            .mul(MISCELLANEOUS.EMPLOYER_COMMITMENT_PERCENTAGE)
            .round()
        )
        .mul(MISCELLANEOUS.EMPLOYER_REJECTION_PINALTY_PERCENTAGE)
        .round();
      projectAsset.freezedFee = utils
        .BigNum(projectAsset.freezedFee)
        .add(employerRejectionPinalty)
        .toString();
    }
    projectAsset.activity.shift();
    projectAsset.freezedFund = utils
      .BigNum(projectAsset.freezedFund)
      .sub(proposalAsset.potentialEarning)
      .toString();
    projectAsset.freezedFee = utils
      .BigNum(projectAsset.freezedFee)
      .sub(projectAsset.commitmentFee)
      .toString();
    proposalAsset.freezedFund = utils
      .BigNum(proposalAsset.freezedFund)
      .add(proposalAsset.potentialEarning)
      .toString();
    proposalAsset.freezedFee = utils
      .BigNum(proposalAsset.freezedFee)
      .add(projectAsset.commitmentFee)
      .toString();
    proposalAsset.term.maxRevision -= 1;
    teamAccounts.forEach((team) => {
      const teamAsset = team.asset;
      if (team.asset.oldStatus === STATUS.TEAM.REJECTED) {
        proposalAsset.freezedFund = utils
          .BigNum(proposalAsset.freezedFund)
          .add(teamAsset.potentialEarning)
          .toString();
        projectAsset.freezedFund = utils
          .BigNum(projectAsset.freezedFund)
          .sub(teamAsset.potentialEarning)
          .toString();
      } else if (team.asset.oldStatus === STATUS.TEAM.SUBMITTED) {
        if (teamAsset.forceReject === false) {
          proposalAsset.freezedFee = utils
            .BigNum(proposalAsset.freezedFee)
            .sub(proposalAsset.term.commitmentFee)
            .toString();
          teamAsset.freezedFee = utils
            .BigNum(teamAsset.freezedFee)
            .add(proposalAsset.term.commitmentFee)
            .toString();
        }
        teamAsset.status = teamAsset.oldStatus;
        teamAsset.forceReject = false;
        delete teamAsset.oldStatus;
        teamAsset.freezedFund = utils
          .BigNum(teamAsset.freezedFund)
          .add(teamAsset.potentialEarning)
          .toString();
        projectAsset.freezedFund = utils
          .BigNum(projectAsset.freezedFund)
          .sub(teamAsset.potentialEarning)
          .toString();
        teamAsset.statusNote.shift();
      } else if (
        [STATUS.TEAM.REQUEST_REVISION, STATUS.TEAM.SELECTED].includes(
          team.asset.status
        ) &&
        team.asset.status === STATUS.TEAM.REJECTED
      ) {
        teamAsset.status = teamAsset.oldStatus;
        delete teamAsset.oldStatus;
        teamAsset.forceReject = false;
        teamAsset.statusNote.shift();
      }
      teamAsset.freezedFund = utils
        .BigNum(teamAsset.freezedFund)
        .sub(utils.BigNum(employerRejectionPinalty).div(pinaltyDivider))
        .round()
        .toString();
      store.account.set(team.address, {
        ...team,
        asset: teamAsset,
      });
    });
    const statusNoteIndex = projectAsset.statusNote
      .map(function (e) {
        return e.submission;
      })
      .indexOf(submissionAccount.publicKey);
    if (statusNoteIndex > -1) {
      projectAsset.statusNote.splice(statusNoteIndex, 1);
    }
    proposalAsset.freezedFund = utils
      .BigNum(proposalAsset.freezedFund)
      .sub(utils.BigNum(employerRejectionPinalty).div(pinaltyDivider))
      .round()
      .toString();
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    store.account.set(proposalAccount.address, {
      ...proposalAccount,
      asset: proposalAsset,
    });
    return [];
  }
}

module.exports = EmployerRequestRevisionTransaction;
