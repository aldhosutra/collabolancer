const RegisterAccountAssetSchema = {
  $id: "lisk/collabolancer/register",
  type: "object",
  required: ["accountType"],
  properties: {
    accountType: {
      dataType: "string",
      fieldNumber: 1,
    },
  },
};

const PostProjectAssetSchema = {
  $id: "lisk/collabolancer/postProject",
  type: "object",
  required: [
    "title",
    "description",
    "category",
    "prize",
    "maxTime",
    "maxRevision",
    "timestamp",
  ],
  properties: {
    title: {
      dataType: "string",
      fieldNumber: 1,
    },
    description: {
      dataType: "string",
      fieldNumber: 2,
    },
    category: {
      dataType: "string",
      fieldNumber: 3,
    },
    prize: {
      dataType: "string",
      fieldNumber: 4,
    },
    maxTime: {
      dataType: "uint32",
      fieldNumber: 5,
    },
    maxRevision: {
      dataType: "uint32",
      fieldNumber: 6,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 7,
    },
  },
};

const PostProposalAssetSchema = {
  $id: "lisk/collabolancer/postProposal",
  type: "object",
  required: ["projectId", "pitching", "term", "timestamp"],
  properties: {
    projectId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    pitching: {
      dataType: "string",
      fieldNumber: 2,
    },
    term: {
      type: "object",
      fieldNumber: 3,
      properties: {
        roleList: {
          type: "array",
          fieldNumber: 1,
          items: {
            dataType: "string",
          },
        },
        brief: {
          dataType: "string",
          fieldNumber: 2,
        },
        maxTime: {
          dataType: "uint32",
          fieldNumber: 3,
        },
        maxRevision: {
          dataType: "uint32",
          fieldNumber: 4,
        },
        distribution: {
          type: "object",
          fieldNumber: 5,
          properties: {
            mode: {
              dataType: "string",
              fieldNumber: 1,
            },
            mode: {
              dataType: "uint32",
              fieldNumber: 2,
            },
          },
        },
      },
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 4,
    },
  },
};

const JoinTeamAssetSchema = {
  $id: "lisk/collabolancer/joinTeam",
  type: "object",
  required: ["proposalId", "role", "timestamp"],
  properties: {
    proposalId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    role: {
      dataType: "uint32",
      fieldNumber: 2,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 3,
    },
  },
};

const StartWorkAssetSchema = {
  $id: "lisk/collabolancer/startWork",
  type: "object",
  required: ["projectId", "selectedProposalId", "timestamp"],
  properties: {
    projectId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    selectedProposalId: {
      dataType: "uint32",
      fieldNumber: 2,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 3,
    },
  },
};

const SubmitContributionAssetSchema = {
  $id: "lisk/collabolancer/submitContribution",
  type: "object",
  required: ["teamId", "extension", "mime", "name", "data", "timestamp"],
  properties: {
    teamId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    extension: {
      dataType: "string",
      fieldNumber: 2,
    },
    mime: {
      dataType: "string",
      fieldNumber: 3,
    },
    name: {
      dataType: "string",
      fieldNumber: 4,
    },
    data: {
      dataType: "bytes",
      fieldNumber: 5,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 6,
    },
  },
};

const RejectContributionAssetSchema = {
  $id: "lisk/collabolancer/rejectContribution",
  type: "object",
  required: ["contributionId", "reason", "timestamp"],
  properties: {
    contributionId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    reason: {
      dataType: "string",
      fieldNumber: 2,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 3,
    },
  },
};

const SubmitSubmissionAssetSchema = {
  $id: "lisk/collabolancer/submitSubmission",
  type: "object",
  required: ["proposalId", "extension", "mime", "name", "data", "timestamp"],
  properties: {
    proposalId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    extension: {
      dataType: "string",
      fieldNumber: 2,
    },
    mime: {
      dataType: "string",
      fieldNumber: 3,
    },
    name: {
      dataType: "string",
      fieldNumber: 4,
    },
    data: {
      dataType: "bytes",
      fieldNumber: 5,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 6,
    },
  },
};

const RejectSubmissionAssetSchema = {
  $id: "lisk/collabolancer/rejectSubmission",
  type: "object",
  required: ["submissionId", "reason", "timestamp"],
  properties: {
    submissionId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    reason: {
      dataType: "string",
      fieldNumber: 2,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 3,
    },
  },
};

const FinishProjectAssetSchema = {
  $id: "lisk/collabolancer/finishProject",
  type: "object",
  required: ["projectId", "timestamp"],
  properties: {
    projectId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 2,
    },
  },
};

const TerminateProjectAssetSchema = {
  $id: "lisk/collabolancer/terminateProject",
  type: "object",
  required: ["projectId", "timestamp"],
  properties: {
    projectId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 2,
    },
  },
};

const CancelProjectAssetSchema = {
  $id: "lisk/collabolancer/cancelProject",
  type: "object",
  required: ["projectId", "timestamp"],
  properties: {
    projectId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 2,
    },
  },
};

const OpenDisputeAssetSchema = {
  $id: "lisk/collabolancer/openDispute",
  type: "object",
  required: ["caseId", "caseType", "projectId", "suit", "maxDays", "timestamp"],
  properties: {
    caseId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    caseType: {
      dataType: "string",
      fieldNumber: 2,
    },
    projectId: {
      dataType: "bytes",
      fieldNumber: 3,
    },
    suit: {
      dataType: "string",
      fieldNumber: 4,
    },
    maxDays: {
      dataType: "uint32",
      fieldNumber: 5,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 6,
    },
  },
};

const VoteDisputeAssetSchema = {
  $id: "lisk/collabolancer/voteDispute",
  type: "object",
  required: ["disputeId", "voteFor", "timestamp"],
  properties: {
    disputeId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    voteFor: {
      dataType: "bytes",
      fieldNumber: 2,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 3,
    },
  },
};

const CloseDisputeAssetSchema = {
  $id: "lisk/collabolancer/closeDispute",
  type: "object",
  required: ["disputeId", "timestamp"],
  properties: {
    disputeId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 2,
    },
  },
};

const ClaimPrizeAssetSchema = {
  $id: "lisk/collabolancer/claimPrize",
  type: "object",
  required: ["projectId", "timestamp"],
  properties: {
    projectId: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 2,
    },
  },
};

module.exports = {
  RegisterAccountAssetSchema,
  PostProjectAssetSchema,
  PostProposalAssetSchema,
  JoinTeamAssetSchema,
  StartWorkAssetSchema,
  SubmitContributionAssetSchema,
  RejectContributionAssetSchema,
  SubmitSubmissionAssetSchema,
  RejectSubmissionAssetSchema,
  FinishProjectAssetSchema,
  TerminateProjectAssetSchema,
  CancelProjectAssetSchema,
  OpenDisputeAssetSchema,
  VoteDisputeAssetSchema,
  CloseDisputeAssetSchema,
  ClaimPrizeAssetSchema,
};
