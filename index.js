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

dotenv.config();
const { extendedAPI } = require("./extendedAPI");
extendedAPI.listen(EXTENDEDAPI_CONFIG.PORT, () => {
  console.log(
    `extendedAPI listening at http://localhost:${EXTENDEDAPI_CONFIG.PORT}`
  );
});

configDevnet.app.label = "collabolancer-blockchain-app";
if (process.env.API_WHITELIST_IP) {
  configDevnet.modules.http_api.access.whiteList.push(
    process.env.API_WHITELIST_IP
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
