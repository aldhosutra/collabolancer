const { Application } = require("lisk-sdk");
const {
  CONSTANTS,
  EXTENDEDAPI_CONFIG,
  genesisBlockDevnet,
  configDevnet,
} = require("./config");
const {
  RegisterEmployerTransaction,
  RegisterWorkerTransaction,
  RegisterSolverTransaction,
  PostProjectTransaction,
  PostProposalTransaction,
  JoinTeamTransaction,
  StartWorkTransaction,
  SubmitContributionTransaction,
  LeaderRequestRevisionTransaction,
  SubmitWorkTransaction,
  EmployerRequestRevisionTransaction,
  FinishWorkTransaction,
  ClaimPrizeTransaction,
  TerminateWorkTransaction,
  CancelWorkTransaction,
  OpenDisputeTransaction,
  VoteDisputeTransaction,
  CloseDisputeTransaction,
} = require("./transactions");
const dotenv = require("dotenv");
const {
  encryptPassphraseWithPassword,
  stringifyEncryptedPassphrase,
  getAddressAndPublicKeyFromPassphrase,
} = require("@liskhq/lisk-cryptography");

dotenv.config();
const { extendedAPI } = require("./extendedAPI");
extendedAPI.listen(EXTENDEDAPI_CONFIG.PORT, () => {
  console.log(
    `extendedAPI listening at http://localhost:${EXTENDEDAPI_CONFIG.PORT}`
  );
});

if (process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
  const https = require("https");
  const fs = require("fs");
  const options = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  };
  https
    .createServer(options, extendedAPI)
    .listen(EXTENDEDAPI_CONFIG.SSL_PORT, () => {
      console.log(
        `extendedAPI SSL listening at http://localhost:${EXTENDEDAPI_CONFIG.SSL_PORT}`
      );
    });
}

configDevnet.app.label = "collabolancer-blockchain-app";
if (process.env.API_WHITELIST_IP) {
  configDevnet.modules.http_api.access.whiteList.push(
    process.env.API_WHITELIST_IP
  );
}
if (process.env.FORGING_WHITELIST_IP) {
  configDevnet.modules.http_api.forging.access.whiteList.push(
    process.env.FORGING_WHITELIST_IP
  );
}
if (process.env.IS_API_NODE && process.env.IS_API_NODE === "true") {
  configDevnet.modules.http_api.access.public = true;
}
if (process.env.SEED_NODE_IP) {
  configDevnet.modules.network.seedPeers.push({
    ip: process.env.SEED_NODE_IP,
    wsPort: 5000,
  });
}
if (process.env.USER_NAME) {
  configDevnet.components.storage.user = process.env.USER_NAME;
}
if (process.env.USER_PASSWORD) {
  configDevnet.components.storage.password = process.env.USER_PASSWORD;
}
if (process.env.DB_NAME) {
  configDevnet.components.storage.database = process.env.DB_NAME;
}
if (process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
  configDevnet.modules.http_api.ssl.enabled = true;
  configDevnet.modules.http_api.ssl.options.key = process.env.SSL_KEY_PATH;
  configDevnet.modules.http_api.ssl.options.cert = process.env.SSL_CERT_PATH;
}
if (process.env.EMPTY_FORGER && process.env.EMPTY_FORGER === "true") {
  configDevnet.modules.chain.forging.delegates = [];
} else if (process.env.NODE_FORGER_PASSPHRASE) {
  const encryptedPassphrase = encryptPassphraseWithPassword(
    process.env.NODE_FORGER_PASSPHRASE,
    configDevnet.modules.chain.forging.defaultPassword,
    1000000
  );
  configDevnet.modules.chain.forging.delegates = [
    {
      encryptedPassphrase: stringifyEncryptedPassphrase(encryptedPassphrase),
      publicKey: getAddressAndPublicKeyFromPassphrase(
        process.env.NODE_FORGER_PASSPHRASE
      ).publicKey,
    },
  ];
}

const app = new Application(genesisBlockDevnet, configDevnet);

const { FaucetTransaction } = require("./transactions/dev/faucet_transaction");
app.registerTransaction(FaucetTransaction);

app.registerTransaction(RegisterEmployerTransaction);
app.registerTransaction(RegisterWorkerTransaction);
app.registerTransaction(RegisterSolverTransaction);
app.registerTransaction(PostProjectTransaction);
app.registerTransaction(PostProposalTransaction);
app.registerTransaction(JoinTeamTransaction);
app.registerTransaction(StartWorkTransaction);
app.registerTransaction(SubmitContributionTransaction);
app.registerTransaction(LeaderRequestRevisionTransaction);
app.registerTransaction(SubmitWorkTransaction);
app.registerTransaction(EmployerRequestRevisionTransaction);
app.registerTransaction(FinishWorkTransaction);
app.registerTransaction(ClaimPrizeTransaction);
app.registerTransaction(TerminateWorkTransaction);
app.registerTransaction(CancelWorkTransaction);
app.registerTransaction(OpenDisputeTransaction);
app.registerTransaction(VoteDisputeTransaction);
app.registerTransaction(CloseDisputeTransaction);

app.constants = {
  ...app.constants,
  ...CONSTANTS,
};

app
  .run()
  .then(() => app.logger.info("App started..."))
  .catch((error) => {
    console.error("Faced error in application", error);
    process.exit(1);
  });
