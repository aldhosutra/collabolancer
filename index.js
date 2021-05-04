const {
  Application,
  HTTPAPIPlugin,
  genesisBlockDevnet,
  configDevnet,
  utils,
} = require("lisk-sdk");
const { CollabolancerModule } = require("./collabolancer_module");
const {
  CollabolancerAccountSchema,
} = require("./collabolancer_module/schemas/account");

genesisBlockDevnet.header.timestamp = 1620149728;
genesisBlockDevnet.header.asset.accounts = genesisBlockDevnet.header.asset.accounts.map(
  (a) =>
    utils.objects.mergeDeep({}, a, {
      collabolancer: CollabolancerAccountSchema.default,
    })
);

const appConfig = utils.objects.mergeDeep({}, configDevnet, {
  label: "collabolancer-app",
  genesisConfig: { communityIdentifier: "COLLABOLANCER" },
  logger: {
    consoleLogLevel: "info",
  },
});

const app = Application.defaultApplication(genesisBlockDevnet, appConfig);

app.registerModule(CollabolancerModule);
app.registerPlugin(HTTPAPIPlugin);

app
  .run()
  .then(() => app.logger.info("App started..."))
  .catch((error) => {
    console.error("Faced error in application", error);
    process.exit(1);
  });
