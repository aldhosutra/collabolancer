const CHAIN_STATE_REGISTERED_ACCOUNT = "collabolancer:registeredAccount";
const CHAIN_STATE_AVAILABLE_CATEGORY = "collabolancer:availableCategory";
const CHAIN_STATE_ALL_PROJECT = "collabolancer:allProject";
const CHAIN_STATE_PROJECT = "collabolancer:project";
const CHAIN_STATE_PROPOSAL = "collabolancer:proposal";
const CHAIN_STATE_TEAM = "collabolancer:team";
const CHAIN_STATE_CONTRIBUTION = "collabolancer:contribution";
const CHAIN_STATE_SUBMISSION = "collabolancer:submission";
const CHAIN_STATE_DISPUTE = "collabolancer:dispute";
const CHAIN_STATE_ALL_FILE = "collabolancer:allFile";
const CHAIN_STATE_ALL_DISPUTE = "collabolancer:allDispute";

const RegisteredAccountSchema = {
  $id: "lisk/collabolancer/registeredAccount",
  type: "object",
  required: ["employer", "worker", "solver"],
  properties: {
    employer: {
      type: "array",
      fieldNumber: 1,
      items: {
        dataType: "bytes",
      },
    },
    worker: {
      type: "array",
      fieldNumber: 2,
      items: {
        dataType: "bytes",
      },
    },
    solver: {
      type: "array",
      fieldNumber: 3,
      items: {
        dataType: "bytes",
      },
    },
  },
};

const AvailableCategorySchema = {
  $id: "lisk/collabolancer/availableCategory",
  type: "object",
  properties: {
    availableCategory: {
      type: "array",
      fieldNumber: 1,
      items: {
        dataType: "string",
      },
    },
  },
};

const AllProjectSchema = {
  $id: "lisk/collabolancer/allProject",
  type: "object",
  properties: {
    availableProject: {
      type: "array",
      fieldNumber: 1,
      items: {
        dataType: "bytes",
      },
    },
    unavailableProject: {
      type: "array",
      fieldNumber: 2,
      items: {
        dataType: "bytes",
      },
    },
  },
};

const AllFileSchema = {
  $id: "lisk/collabolancer/allFile",
  type: "object",
  properties: {
    fileId: {
      type: "array",
      fieldNumber: 1,
      items: {
        dataType: "bytes",
      },
    },
  },
};

const AllDisputeSchema = {
  $id: "lisk/collabolancer/allDispute",
  type: "object",
  properties: {
    availableDispute: {
      type: "array",
      fieldNumber: 1,
      items: {
        dataType: "bytes",
      },
    },
    unavailableDispute: {
      type: "array",
      fieldNumber: 2,
      items: {
        dataType: "bytes",
      },
    },
  },
};

module.exports = {
  RegisteredAccountSchema,
  AvailableCategorySchema,
  AllProjectSchema,
  AllFileSchema,
  AllDisputeSchema,
  CHAIN_STATE_REGISTERED_ACCOUNT,
  CHAIN_STATE_AVAILABLE_CATEGORY,
  CHAIN_STATE_ALL_PROJECT,
  CHAIN_STATE_PROJECT,
  CHAIN_STATE_PROPOSAL,
  CHAIN_STATE_TEAM,
  CHAIN_STATE_CONTRIBUTION,
  CHAIN_STATE_SUBMISSION,
  CHAIN_STATE_DISPUTE,
  CHAIN_STATE_ALL_FILE,
  CHAIN_STATE_ALL_DISPUTE,
};
