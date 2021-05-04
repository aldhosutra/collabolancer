const { BaseAsset } = require("lisk-sdk");
const ACCOUNT = require("../constants/account_type");
const { COLLABOLANCER_REGISTER_ACCOUNT_ASSET_ID } = require("../constants/id");
const { RegisterAccountAssetSchema } = require("../schemas/asset");
const {
  getAllRegisteredAccount,
  setRegisteredAccount,
} = require("../utils/chain_state");

class RegisterAccountAsset extends BaseAsset {
  name = "registerAccount";
  id = COLLABOLANCER_REGISTER_ACCOUNT_ASSET_ID;
  schema = RegisterAccountAssetSchema;

  validate({ asset }) {
    if (
      !asset.accountType ||
      typeof asset.accountType !== "string" ||
      ![ACCOUNT.EMPLOYER, ACCOUNT.WORKER, ACCOUNT.SOLVER].includes(
        asset.accountType
      )
    ) {
      throw new Error(
        `Invalid "asset.accountType" defined on transaction: A string value with value ${[
          ACCOUNT.EMPLOYER,
          ACCOUNT.WORKER,
          ACCOUNT.SOLVER,
        ].toString()} is expected`
      );
    }
  }

  async apply({ asset, stateStore, reducerHandler, transaction }) {
    const senderAddress = transaction.senderAddress;
    const senderAccount = await stateStore.account.get(senderAddress);
    const registeredAccount = await getAllRegisteredAccount(stateStore);

    if (senderAccount.collabolancer.accountType !== "") {
      throw new Error("Account already registered");
    }

    const registeredAccountIndex = registeredAccount.findIndex((t) =>
      t[asset.accountType].equals(asset.accountType)
    );

    if (registeredAccountIndex >= 0) {
      throw new Error("Account with corresponding type already registered");
    }

    senderAccount.collabolancer.accountType = asset.accountType;
    await stateStore.account.set(senderAccount.address, senderAccount);

    registeredAccount[asset.accountType].unshift(transaction.senderAddress);
    await setRegisteredAccount(stateStore, registeredAccount);
  }
}

module.exports = { RegisterAccountAsset };
