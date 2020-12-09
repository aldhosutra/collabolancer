const { getStateCenterAccount, store_account_get } = require("./utils");
const { ACCOUNT, STATUS, MISCELLANEOUS } = require("./constants");
const {
  BaseTransaction,
  TransactionError,
  utils,
} = require("@liskhq/lisk-transactions");
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");

/**
 * This custom transaction can only be executed by employer (Project owner).
 * Executed when employer select a winner team to work on project.
 *
 * Required:
 * this.asset.projectPublicKey
 * this.asset.selectedProposalPublicKey
 */
class StartWorkTransaction extends BaseTransaction {
  static get TYPE() {
    return 107;
  }

  /**
   * Set the `StartWorkTransaction` transaction FEE to 0.
   * Every time a user posts a transaction to the network, the transaction fee is paid to the delegate who includes the transaction into the block that the delegate forges.
   */
  static get FEE() {
    return `0`;
  }

  /**
   * Prepares the necessary data for the `apply` and `undo` step.
   * In this case, many account need to be prepared, the goal is to retrieve leader list and team worker list
   * To do that, first we need to get project details where proposal list are stored
   * next, from that proposal, we need to cache each proposal, because we need team info inside it
   * then, we retrieve team list from cached proposal
   * finally, we concat leader address and worker address, and prepare them for applyAsset
   */
  async prepare(store) {
    // retrieve project details
    await store.account.cache([
      {
        address: this.senderId,
      },
      {
        address: getAddressFromPublicKey(this.asset.projectPublicKey),
      },
      {
        address: getAddressFromPublicKey(this.asset.selectedProposalPublicKey),
      },
      {
        address: getStateCenterAccount().address,
      },
    ]);

    // retrieve selected team details
    const selectedProposalAccount = store.account.get(
      getAddressFromPublicKey(this.asset.selectedProposalPublicKey)
    );
    if (
      selectedProposalAccount.asset.team.filter((el) => el !== 0).length > 0
    ) {
      await store.account.cache({
        address_in: selectedProposalAccount.asset.team
          .filter((el) => el !== 0)
          .map((data) => getAddressFromPublicKey(data)),
      });
    }

    // retrieve list proposal from specified project
    const proposalList = [];
    const projectAccount = store.account.get(
      getAddressFromPublicKey(this.asset.projectPublicKey)
    );
    projectAccount.asset.proposal.forEach((element) => {
      if (element !== this.asset.selectedProposalPublicKey) {
        proposalList.push(getAddressFromPublicKey(element));
      }
    });
    if (proposalList.length > 0) {
      await store.account.cache({
        address_in: proposalList,
      });
    }

    // retrieve list of teamAccount and its worker address from concerning proposal
    let teamAddress = [];
    let leaderAddress = [];
    proposalList.forEach((element) => {
      const proposalAcc = store.account.get(element);
      leaderAddress.push(proposalAcc.asset.leader);
      teamAddress = teamAddress.concat(
        proposalAcc.asset.team
          .filter((el) => el !== 0)
          .map((data) => getAddressFromPublicKey(data))
      );
    });
    if (teamAddress.length > 0) {
      await store.account.cache({
        address_in: teamAddress,
      });
      await store.account.cache({
        address_in: teamAddress.map((el) => store.account.get(el).asset.worker),
      });
    }
    if (leaderAddress.length > 0) {
      await store.account.cache({
        address_in: leaderAddress,
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
      !this.asset.selectedProposalPublicKey ||
      typeof this.asset.selectedProposalPublicKey !== "string"
    ) {
      errors.push(
        new TransactionError(
          'Invalid "asset.selectedProposalPublicKey" defined on transaction',
          this.id,
          ".asset.selectedProposalPublicKey",
          this.asset.selectedProposalPublicKey,
          "selectedProposalPublicKey is required, and must be string"
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
      const selectedProposalAccount = store_account_get(
        this.asset.selectedProposalPublicKey,
        store
      );
      const stateCenter = store_account_get(
        getStateCenterAccount().publicKey,
        store
      );
      const nonSelectedProposalAccount = [];
      const teamAccount = [];
      const commitmentFeeReleaseList = [];
      let pinaltyPool = "0";
      let totalFeeReleased = "0";
      projectAccount.asset.proposal.forEach((element) => {
        if (element !== this.asset.selectedProposalPublicKey) {
          nonSelectedProposalAccount.push(
            store.account.get(getAddressFromPublicKey(element))
          );
        }
      });
      nonSelectedProposalAccount.forEach((element) => {
        element.asset.team
          .filter((el) => el !== 0)
          .forEach((el) => {
            teamAccount.push(store.account.get(getAddressFromPublicKey(el)));
          });
      });
      nonSelectedProposalAccount.forEach((element) => {
        pinaltyPool = utils
          .BigNum(pinaltyPool)
          .add(
            utils
              .BigNum(projectAccount.asset.commitmentFee)
              .mul(MISCELLANEOUS.LEADER_NOTSELECTED_PINALTY_PERCENTAGE)
              .round()
          )
          .toString();
        totalFeeReleased = utils
          .BigNum(totalFeeReleased)
          .add(projectAccount.asset.commitmentFee)
          .toString();
        commitmentFeeReleaseList.push({
          address: element.asset.leader,
          released: utils
            .BigNum(projectAccount.asset.commitmentFee)
            .sub(
              utils
                .BigNum(projectAccount.asset.commitmentFee)
                .mul(MISCELLANEOUS.LEADER_NOTSELECTED_PINALTY_PERCENTAGE)
                .round()
            )
            .toString(),
        });
        element.asset.team
          .filter((el) => el !== 0)
          .forEach((item) => {
            const workerAccount = store.account.get(
              getAddressFromPublicKey(item)
            );
            commitmentFeeReleaseList.push({
              address: workerAccount.asset.worker,
              released: utils
                .BigNum(element.asset.term.commitmentFee)
                .toString(),
            });
          });
      });
      if (
        Object.prototype.hasOwnProperty.call(sender.asset, "type") &&
        sender.asset.type !== ACCOUNT.EMPLOYER
      ) {
        errors.push(
          new TransactionError(
            "Sender is not employer",
            this.id,
            "sender.asset.type",
            sender.asset.type,
            `Type mush be ${ACCOUNT.EMPLOYER}`
          )
        );
      }
      if (projectAccount.asset.employer !== sender.address) {
        errors.push(
          new TransactionError(
            "sender is not owner of project",
            this.id,
            "sender.address",
            sender.address,
            "Owner is: " + projectAccount.asset.employer
          )
        );
      }
      if (
        !projectAccount.asset.proposal.includes(
          this.asset.selectedProposalPublicKey
        )
      ) {
        errors.push(
          new TransactionError(
            "asset.selectedProposalPublicKey is not present in projectAccount proposal",
            this.id,
            ".asset.selectedProposalPublicKey",
            this.asset.selectedProposalPublicKey,
            "This value should present in: " +
              projectAccount.asset.proposal.toString()
          )
        );
      }
      if (errors.length === 0) {
        nonSelectedProposalAccount.forEach((element) => {
          const commitmentFeeReleaseListIndex = commitmentFeeReleaseList
            .map((el) => el.address)
            .indexOf(element.asset.leader);
          store.account.set(element.address, {
            ...element,
            asset: {
              ...element.asset,
              status: STATUS.PROPOSAL.NOT_SELECTED,
              freezedFee: utils
                .BigNum(0)
                .add(
                  commitmentFeeReleaseList[commitmentFeeReleaseListIndex]
                    .released
                )
                .toString(),
            },
          });
        });
        teamAccount.forEach((element) => {
          const commitmentFeeReleaseListIndex = commitmentFeeReleaseList
            .map((el) => el.address)
            .indexOf(element.asset.worker);
          store.account.set(element.address, {
            ...element,
            asset: {
              ...element.asset,
              status: STATUS.TEAM.NOT_SELECTED,
              freezedFee: utils
                .BigNum(0)
                .add(
                  commitmentFeeReleaseList[commitmentFeeReleaseListIndex]
                    .released
                )
                .toString(),
            },
          });
        });
        commitmentFeeReleaseList.forEach((element) => {
          const releasedAccount = store.account.get(element.address);
          const releasedAsset = {
            joined: [],
            ...releasedAccount.asset,
          };
          const joinedIndex = releasedAsset.joined.indexOf(
            projectAccount.publicKey
          );
          if (joinedIndex > -1) {
            releasedAsset.joined.splice(joinedIndex, 1);
          }
          releasedAsset.log.unshift({
            timestamp: this.timestamp,
            id: this.id,
            type: this.type,
            value: utils.BigNum(0).add(element.released).toString(),
          });
          releasedAsset.earning = utils
            .BigNum(releasedAsset.earning)
            .add(element.released)
            .toString();
          store.account.set(releasedAccount.address, {
            ...releasedAccount,
            balance: utils
              .BigNum(releasedAccount.balance)
              .add(element.released)
              .toString(),
            asset: releasedAsset,
          });
        });
        const projectAsset = {
          ...projectAccount.asset,
          winner: this.asset.selectedProposalPublicKey,
          workStarted: this.timestamp,
          status: STATUS.PROJECT.WORKING,
        };
        projectAsset.freezedFee = utils
          .BigNum(projectAsset.freezedFee)
          .sub(totalFeeReleased)
          .toString();
        const stateAsset = {
          ...stateCenter.asset,
          unavailable: {
            projects: [],
            ...stateCenter.asset.unavailable,
          },
        };
        stateAsset.unavailable.projects.unshift(projectAccount.publicKey);
        stateAsset.available.projects.splice(
          stateAsset.available.projects.indexOf(projectAccount.publicKey),
          1
        );
        store.account.set(stateCenter.address, {
          ...stateCenter,
          asset: stateAsset,
        });
        projectAsset.activity.unshift({
          timestamp: this.timestamp,
          id: this.id,
          type: this.type,
        });
        store.account.set(projectAccount.address, {
          ...projectAccount,
          asset: projectAsset,
        });
        const pinaltyPoolDivider =
          selectedProposalAccount.asset.team.filter((el) => el !== 0).length +
          1;
        const teamFreeSlotLength = selectedProposalAccount.asset.team.filter(
          (el) => el === 0
        ).length;
        const teamLength = selectedProposalAccount.asset.team.filter(
          (el) => el !== 0
        ).length;
        let noTeamAppliedBonus = 0;
        if (teamLength === 0) {
          noTeamAppliedBonus = utils
            .BigNum(teamFreeSlotLength)
            .mul(
              utils
                .BigNum(selectedProposalAccount.asset.term.commitmentFee)
                .div(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
                .round()
            );
        }
        let teamFreeSlotBonus = 0;
        if (
          selectedProposalAccount.asset.term.distribution.mode ===
          MISCELLANEOUS.DISTRIBUTION.LEADER_FIRST
        ) {
          teamFreeSlotBonus = utils
            .BigNum(teamFreeSlotLength)
            .mul(
              utils
                .BigNum(selectedProposalAccount.asset.term.commitmentFee)
                .div(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
                .round()
            )
            .div(teamLength)
            .round();
        } else if (
          selectedProposalAccount.asset.term.distribution.mode ===
          MISCELLANEOUS.DISTRIBUTION.ALL_EQUAL
        ) {
          teamFreeSlotBonus = utils
            .BigNum(teamFreeSlotLength)
            .mul(
              utils
                .BigNum(selectedProposalAccount.asset.term.commitmentFee)
                .div(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
                .round()
            )
            .div(teamLength + 1)
            .round();
          noTeamAppliedBonus = utils
            .BigNum(noTeamAppliedBonus)
            .add(teamFreeSlotBonus);
        }
        store.account.set(selectedProposalAccount.address, {
          ...selectedProposalAccount,
          asset: {
            ...selectedProposalAccount.asset,
            status: STATUS.PROPOSAL.SELECTED,
            potentialEarning: utils
              .BigNum(selectedProposalAccount.asset.potentialEarning)
              .add(noTeamAppliedBonus)
              .toString(),
            freezedFee: utils
              .BigNum(selectedProposalAccount.asset.freezedFee)
              .add(utils.BigNum(pinaltyPool).div(pinaltyPoolDivider))
              .round()
              .toString(),
          },
        });
        selectedProposalAccount.asset.team
          .filter((el) => el !== 0)
          .forEach((element) => {
            const selectedTeamAccount = store.account.get(
              getAddressFromPublicKey(element)
            );
            store.account.set(selectedTeamAccount.address, {
              ...selectedTeamAccount,
              asset: {
                ...selectedTeamAccount.asset,
                status: STATUS.TEAM.SELECTED,
                potentialEarning: utils
                  .BigNum(selectedTeamAccount.asset.potentialEarning)
                  .add(teamFreeSlotBonus)
                  .toString(),
                freezedFee: utils
                  .BigNum(selectedTeamAccount.asset.freezedFee)
                  .add(utils.BigNum(pinaltyPool).div(pinaltyPoolDivider))
                  .round()
                  .toString(),
              },
            });
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
    const nonSelectedProposalAccount = [];
    const teamAccount = [];
    const commitmentFeeReleaseList = [];
    let pinaltyPool = "0";
    let totalFeeReleased = "0";

    const projectAccount = store_account_get(
      this.asset.projectPublicKey,
      store
    );
    const selectedProposalAccount = store_account_get(
      this.asset.selectedProposalPublicKey,
      store
    );
    const stateCenter = store_account_get(
      getStateCenterAccount().publicKey,
      store
    );
    projectAccount.asset.proposal.forEach((element) => {
      if (element !== this.asset.selectedProposalPublicKey) {
        nonSelectedProposalAccount.push(
          store.account.get(getAddressFromPublicKey(element))
        );
      }
    });
    nonSelectedProposalAccount.forEach((element) => {
      element.asset.team
        .filter((el) => el !== 0)
        .forEach((el) => {
          teamAccount.push(store.account.get(getAddressFromPublicKey(el)));
        });
    });
    nonSelectedProposalAccount.forEach((element) => {
      pinaltyPool = utils
        .BigNum(pinaltyPool)
        .add(
          utils
            .BigNum(projectAccount.asset.commitmentFee)
            .mul(MISCELLANEOUS.LEADER_NOTSELECTED_PINALTY_PERCENTAGE)
            .round()
        )
        .toString();
      totalFeeReleased = utils
        .BigNum(totalFeeReleased)
        .add(projectAccount.asset.commitmentFee)
        .toString();
      commitmentFeeReleaseList.push({
        address: element.asset.leader,
        released: utils
          .BigNum(projectAccount.asset.commitmentFee)
          .sub(
            utils
              .BigNum(projectAccount.asset.commitmentFee)
              .mul(MISCELLANEOUS.LEADER_NOTSELECTED_PINALTY_PERCENTAGE)
              .round()
          )
          .toString(),
      });
      element.asset.team
        .filter((el) => el !== 0)
        .forEach((item) => {
          const workerAccount = store.account.get(
            getAddressFromPublicKey(item)
          );
          commitmentFeeReleaseList.push({
            address: workerAccount.asset.worker,
            released: utils.BigNum(element.asset.term.commitmentFee).toString(),
          });
        });
    });

    nonSelectedProposalAccount.forEach((element) => {
      store.account.set(element.address, {
        ...element,
        asset: {
          ...element.asset,
          status: STATUS.PROPOSAL.APPLIED,
          freezedFee: "0",
        },
      });
    });
    teamAccount.forEach((element) => {
      store.account.set(element.address, {
        ...element,
        asset: {
          ...element.asset,
          status: STATUS.TEAM.APPLIED,
          freezedFee: "0",
        },
      });
    });
    commitmentFeeReleaseList.forEach((element) => {
      const releasedAccount = store.account.get(element.address);
      const releasedAsset = releasedAccount.asset;
      releasedAsset.joined.unshift(projectAccount.publicKey);
      releasedAsset.log.shift();
      releasedAsset.earning = utils
        .BigNum(releasedAsset.earning)
        .sub(element.released)
        .toString();
      store.account.set(releasedAccount.address, {
        ...releasedAccount,
        balance: utils
          .BigNum(releasedAccount.balance)
          .sub(element.released)
          .toString(),
      });
    });
    const projectAsset = {
      ...projectAccount.asset,
      winner: null,
      workStarted: null,
      status: STATUS.PROJECT.OPEN,
    };
    projectAsset.freezedFee = utils
      .BigNum(projectAsset.freezedFee)
      .add(totalFeeReleased)
      .toString();
    const stateAsset = stateCenter.asset;
    stateAsset.available.projects.unshift(projectAccount.publicKey);
    stateAsset.unavailable.projects.splice(
      stateAsset.unavailable.projects.indexOf(projectAccount.publicKey),
      1
    );
    store.account.set(stateCenter.address, {
      ...stateCenter,
      asset: stateAsset,
    });
    projectAsset.activity.shift();
    store.account.set(projectAccount.address, {
      ...projectAccount,
      asset: projectAsset,
    });
    const pinaltyPoolDivider =
      selectedProposalAccount.asset.team.filter((el) => el !== 0).length + 1;
    const teamFreeSlotLength = selectedProposalAccount.asset.team.filter(
      (el) => el === 0
    ).length;
    const teamLength = selectedProposalAccount.asset.team.filter(
      (el) => el !== 0
    ).length;
    let noTeamAppliedBonus = 0;
    if (teamLength === 0) {
      noTeamAppliedBonus = utils
        .BigNum(teamFreeSlotLength)
        .mul(
          utils
            .BigNum(selectedProposalAccount.asset.term.commitmentFee)
            .div(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
            .round()
        );
    }
    let teamFreeSlotBonus = 0;
    if (
      selectedProposalAccount.asset.term.distribution.mode ===
      MISCELLANEOUS.DISTRIBUTION.LEADER_FIRST
    ) {
      teamFreeSlotBonus = utils
        .BigNum(teamFreeSlotLength)
        .mul(
          utils
            .BigNum(selectedProposalAccount.asset.term.commitmentFee)
            .div(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
            .round()
        )
        .div(teamLength)
        .round();
    } else if (
      selectedProposalAccount.asset.term.distribution.mode ===
      MISCELLANEOUS.DISTRIBUTION.ALL_EQUAL
    ) {
      teamFreeSlotBonus = utils
        .BigNum(teamFreeSlotLength)
        .mul(
          utils
            .BigNum(selectedProposalAccount.asset.term.commitmentFee)
            .div(MISCELLANEOUS.TEAM_COMMITMENT_PERCENTAGE)
            .round()
        )
        .div(teamLength + 1)
        .round();
      noTeamAppliedBonus = utils
        .BigNum(noTeamAppliedBonus)
        .add(teamFreeSlotBonus);
    }
    store.account.set(selectedProposalAccount.address, {
      ...selectedProposalAccount,
      asset: {
        ...selectedProposalAccount.asset,
        status: STATUS.PROPOSAL.APPLIED,
        potentialEarning: utils
          .BigNum(selectedProposalAccount.asset.potentialEarning)
          .sub(noTeamAppliedBonus)
          .toString(),
        freezedFee: utils
          .BigNum(selectedProposalAccount.asset.freezedFee)
          .sub(utils.BigNum(pinaltyPool).div(pinaltyPoolDivider))
          .round()
          .toString(),
      },
    });
    selectedProposalAccount.asset.team
      .filter((el) => el !== 0)
      .forEach((element) => {
        const selectedTeamAccount = store.account.get(
          getAddressFromPublicKey(element)
        );
        store.account.set(selectedTeamAccount.address, {
          ...selectedTeamAccount,
          asset: {
            ...selectedTeamAccount.asset,
            status: STATUS.TEAM.SELECTED,
            potentialEarning: utils
              .BigNum(selectedTeamAccount.asset.potentialEarning)
              .sub(teamFreeSlotBonus)
              .toString(),
            freezedFee: utils
              .BigNum(selectedTeamAccount.asset.freezedFee)
              .sub(utils.BigNum(pinaltyPool).div(pinaltyPoolDivider))
              .round()
              .toString(),
          },
        });
      });
    return [];
  }
}

module.exports = StartWorkTransaction;
