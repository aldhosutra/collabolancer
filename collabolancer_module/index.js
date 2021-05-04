const { BaseModule, codec } = require("lisk-sdk");
const { COLLABOLANCER_MODULE_ID } = require("./constants/id");
const category = require("./constants/category");
const { CollabolancerAccountSchema } = require("./schemas/account");
const {
  AvailableCategorySchema,
  CHAIN_STATE_AVAILABLE_CATEGORY,
} = require("./schemas/chain");

const { RegisterAccountAsset } = require("./assets/register_account");
const { PostProjectAsset } = require("./assets/post_project");
const { PostProposalAsset } = require("./assets/post_proposal");
const { JoinTeamAsset } = require("./assets/join_team");
const { StartWorkAsset } = require("./assets/start_work");
const { SubmitContributionAsset } = require("./assets/submit_contribution");
const { RejectContributionAsset } = require("./assets/reject_contribution");
const { SubmitSubmissionAsset } = require("./assets/submit_submission");
const { RejectSubmissionAsset } = require("./assets/reject_submission");
const { FinishProjectAsset } = require("./assets/finish_project");
const { TerminateProjectAsset } = require("./assets/terminate_project");
const { CancelProjectAsset } = require("./assets/cancel_project");
const { OpenDisputeAsset } = require("./assets/open_dispute");
const { VoteDisputeAsset } = require("./assets/vote _dispute");
const { CloseDisputeAsset } = require("./assets/close_dispute");
const { ClaimPrizeAsset } = require("./assets/claim_prize");

class CollabolancerModule extends BaseModule {
  name = "collabolancer";
  id = COLLABOLANCER_MODULE_ID;
  accountSchema = CollabolancerAccountSchema;

  transactionAssets = [
    new RegisterAccountAsset(),
    new PostProjectAsset(),
    new PostProposalAsset(),
    new JoinTeamAsset(),
    new StartWorkAsset(),
    new SubmitContributionAsset(),
    new RejectContributionAsset(),
    new SubmitSubmissionAsset(),
    new RejectSubmissionAsset(),
    new FinishProjectAsset(),
    new TerminateProjectAsset(),
    new CancelProjectAsset(),
    new OpenDisputeAsset(),
    new VoteDisputeAsset(),
    new CloseDisputeAsset(),
    new ClaimPrizeAsset(),
  ];

  async afterGenesisBlockApply({ genesisBlock, stateStore, reducerHandler }) {
    await stateStore.chain.set(
      CHAIN_STATE_AVAILABLE_CATEGORY,
      codec.encode(AvailableCategorySchema, {
        availableCategory: category.available,
      })
    );
  }
}

module.exports = { CollabolancerModule };
