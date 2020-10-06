const { Application, genesisBlockDevnet, configDevnet } = require("lisk-sdk");
const { CONSTANTS, EXTENDEDAPI_CONFIG } = require("./config");
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

const { extendedAPI } = require("./extendedAPI");
extendedAPI.listen(EXTENDEDAPI_CONFIG.PORT, () => {
  console.log(
    `extendedAPI listening at http://localhost:${EXTENDEDAPI_CONFIG.PORT}`
  );
});

configDevnet.app.label = "collabolancer-blockchain-app";
configDevnet.modules.http_api.access.whiteList = ["127.0.0.1", "172.17.0.1"];

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
