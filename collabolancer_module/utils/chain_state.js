const {
  CHAIN_STATE_REGISTERED_ACCOUNT,
  RegisteredAccountSchema,
  CHAIN_STATE_AVAILABLE_CATEGORY,
  AvailableCategorySchema,
  CHAIN_STATE_ALL_PROJECT,
  AllProjectSchema,
  CHAIN_STATE_PROJECT,
  CHAIN_STATE_PROPOSAL,
  CHAIN_STATE_TEAM,
  CHAIN_STATE_CONTRIBUTION,
  CHAIN_STATE_ALL_FILE,
  AllFileSchema,
  CHAIN_STATE_SUBMISSION,
  CHAIN_STATE_ALL_DISPUTE,
  AllDisputeSchema,
  CHAIN_STATE_DISPUTE,
} = require("../schemas/chain");
const {
  ProjectSchema,
  ProposalSchema,
  TeamSchema,
  ContributionSchema,
  SubmissionSchema,
  DisputeSchema,
} = require("../schemas/account");
const { codec, cryptography } = require("lisk-sdk");

const getAllRegisteredAccount = async (stateStore) => {
  const registeredAccountBuffer = await stateStore.chain.get(
    CHAIN_STATE_REGISTERED_ACCOUNT
  );
  if (!registeredAccountBuffer) {
    return [];
  }

  const registeredAccount = codec.decode(
    RegisteredAccountSchema,
    registeredAccountBuffer
  );

  return registeredAccount;
};

const setRegisteredAccount = async (stateStore, registeredAccount) => {
  await stateStore.chain.set(
    CHAIN_STATE_REGISTERED_ACCOUNT,
    codec.encode(RegisteredAccountSchema, registeredAccount)
  );
};

const getAvailableCategory = async (stateStore) => {
  const availableCategoryBuffer = await stateStore.chain.get(
    CHAIN_STATE_AVAILABLE_CATEGORY
  );
  if (!availableCategoryBuffer) {
    return [];
  }

  const availableCategory = codec.decode(
    AvailableCategorySchema,
    availableCategoryBuffer
  );

  return availableCategory.availableCategory;
};

const generateID = (source, nonce) => {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigInt64LE(nonce);
  const seed = Buffer.concat([source, nonceBuffer]);
  return cryptography.hash(seed);
};

const getAllProject = async (stateStore) => {
  const allProjectBuffer = await stateStore.chain.get(CHAIN_STATE_ALL_PROJECT);
  if (!allProjectBuffer) {
    return {
      availableProject: [],
      unavailableProject: [],
    };
  }

  const allProject = codec.decode(AllProjectSchema, allProjectBuffer);

  return allProject;
};

const setAllProject = async (stateStore, project) => {
  await stateStore.chain.set(
    CHAIN_STATE_ALL_PROJECT,
    codec.encode(AllProjectSchema, project)
  );
};

const getAllFile = async (stateStore) => {
  const allFileBuffer = await stateStore.chain.get(CHAIN_STATE_ALL_FILE);
  if (!allFileBuffer) {
    return [];
  }

  const allFile = codec.decode(AllFileSchema, allFileBuffer);

  return allFile.fileId;
};

const setAllFile = async (stateStore, file) => {
  await stateStore.chain.set(
    CHAIN_STATE_ALL_FILE,
    codec.encode(AllFileSchema, { fileId: file })
  );
};

const getAllDispute = async (stateStore) => {
  const allDisputeBuffer = await stateStore.chain.get(CHAIN_STATE_ALL_DISPUTE);
  if (!allDisputeBuffer) {
    return {
      availableDispute: [],
      unavailableDispute: [],
    };
  }

  const allDispute = codec.decode(AllDisputeSchema, allDisputeBuffer);

  return allDispute;
};

const setAllDispute = async (stateStore, dispute) => {
  await stateStore.chain.set(
    CHAIN_STATE_ALL_DISPUTE,
    codec.encode(AllDisputeSchema, dispute)
  );
};

const getProjectById = async (stateStore, id) => {
  const projectBuffer = await stateStore.chain.get(
    CHAIN_STATE_PROJECT.concat(":", id)
  );
  if (!projectBuffer) {
    return null;
  }

  return codec.decode(ProjectSchema, projectBuffer);
};

const setProjectById = async (stateStore, id, project) => {
  await stateStore.chain.set(
    CHAIN_STATE_PROJECT.concat(":", id),
    codec.encode(ProjectSchema, project)
  );
};

const getProposalById = async (stateStore, id) => {
  const proposalBuffer = await stateStore.chain.get(
    CHAIN_STATE_PROPOSAL.concat(":", id)
  );
  if (!proposalBuffer) {
    return null;
  }

  return codec.decode(ProposalSchema, proposalBuffer);
};

const setProposalById = async (stateStore, id, proposal) => {
  await stateStore.chain.set(
    CHAIN_STATE_PROPOSAL.concat(":", id),
    codec.encode(ProposalSchema, proposal)
  );
};

const getTeamById = async (stateStore, id) => {
  const teamBuffer = await stateStore.chain.get(
    CHAIN_STATE_TEAM.concat(":", id)
  );
  if (!teamBuffer) {
    return null;
  }

  return codec.decode(TeamSchema, teamBuffer);
};

const setTeamById = async (stateStore, id, team) => {
  await stateStore.chain.set(
    CHAIN_STATE_TEAM.concat(":", id),
    codec.encode(TeamSchema, team)
  );
};

const getContributionById = async (stateStore, id) => {
  const contributionBuffer = await stateStore.chain.get(
    CHAIN_STATE_CONTRIBUTION.concat(":", id)
  );
  if (!contributionBuffer) {
    return null;
  }

  return codec.decode(ContributionSchema, contributionBuffer);
};

const setContributionById = async (stateStore, id, contribution) => {
  await stateStore.chain.set(
    CHAIN_STATE_CONTRIBUTION.concat(":", id),
    codec.encode(ContributionSchema, contribution)
  );
};

const getSubmissionById = async (stateStore, id) => {
  const submissionBuffer = await stateStore.chain.get(
    CHAIN_STATE_SUBMISSION.concat(":", id)
  );
  if (!submissionBuffer) {
    return null;
  }

  return codec.decode(SubmissionSchema, submissionBuffer);
};

const setSubmissionById = async (stateStore, id, submission) => {
  await stateStore.chain.set(
    CHAIN_STATE_SUBMISSION.concat(":", id),
    codec.encode(SubmissionSchema, submission)
  );
};

const getDisputeById = async (stateStore, id) => {
  const disputeBuffer = await stateStore.chain.get(
    CHAIN_STATE_DISPUTE.concat(":", id)
  );
  if (!disputeBuffer) {
    return null;
  }

  return codec.decode(DisputeSchema, disputeBuffer);
};

const setDisputeById = async (stateStore, id, dispute) => {
  await stateStore.chain.set(
    CHAIN_STATE_DISPUTE.concat(":", id),
    codec.encode(DisputeSchema, dispute)
  );
};

module.exports = {
  getAllRegisteredAccount,
  setRegisteredAccount,
  getAvailableCategory,
  generateID,
  getAllProject,
  setAllProject,
  getAllFile,
  setAllFile,
  getAllDispute,
  setAllDispute,
  getProjectById,
  setProjectById,
  getProposalById,
  setProposalById,
  getTeamById,
  setTeamById,
  getContributionById,
  setContributionById,
  getSubmissionById,
  setSubmissionById,
  getDisputeById,
  setDisputeById,
};
