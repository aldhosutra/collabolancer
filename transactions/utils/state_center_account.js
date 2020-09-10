const cryptography = require("@liskhq/lisk-cryptography");
const { Mnemonic } = require("@liskhq/lisk-passphrase");
const fs = require("fs");

const createAccount = () => {
  const passphrase = Mnemonic.generateMnemonic();
  const keys = cryptography.getPrivateAndPublicKeyFromPassphrase(passphrase);
  const credentials = {
    address: cryptography.getAddressFromPublicKey(keys.publicKey),
    passphrase: passphrase,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };
  return credentials;
};

const createStateCenterAccount = () => {
  const account = createAccount();
  const credentials = {
    address: account.address,
    publicKey: account.publicKey,
  };
  fs.writeFileSync(
    "./transactions/utils/state_center.json",
    JSON.stringify(credentials, null, 2),
    "utf-8"
  );
};

const getStateCenterAccount = () => {
  if (!fs.existsSync("./transactions/utils/state_center.json")) {
    createStateCenterAccount();
  }
  let rawdata = fs.readFileSync("./transactions/utils/state_center.json");
  let state_center = JSON.parse(rawdata);
  return state_center;
};

module.exports = {
  createAccount,
  createStateCenterAccount,
  getStateCenterAccount,
};
