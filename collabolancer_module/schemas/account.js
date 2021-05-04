const CollabolancerAccountSchema = {
  type: "object",
  required: ["accountType"],
  properties: {
    accountType: {
      fieldNumber: 1,
      dataType: "string",
    },
    employer: {
      type: "object",
      fieldNumber: 2,
      properties: {
        done: {
          type: "array",
          fieldNumber: 1,
          items: {
            dataType: "bytes",
          },
        },
        terminated: {
          type: "array",
          fieldNumber: 2,
          items: {
            dataType: "bytes",
          },
        },
        guilty: {
          type: "array",
          fieldNumber: 3,
          items: {
            dataType: "bytes",
          },
        },
        ongoing: {
          type: "array",
          fieldNumber: 4,
          items: {
            dataType: "bytes",
          },
        },
        spent: {
          dataType: "uint64",
          fieldNumber: 5,
        },
        log: {
          type: "array",
          fieldNumber: 6,
          items: {
            type: "object",
            properties: {
              timestamp: {
                dataType: "uint32",
                fieldNumber: 1,
              },
              assetType: {
                dataType: "uint32",
                fieldNumber: 2,
              },
              value: {
                dataType: "uint64",
                fieldNumber: 3,
              },
              id: {
                dataType: "bytes",
                fieldNumber: 4,
              },
            },
          },
        },
      },
    },
    worker: {
      type: "object",
      fieldNumber: 3,
      properties: {
        leaderOf: {
          type: "array",
          fieldNumber: 1,
          items: {
            dataType: "bytes",
          },
        },
        contributorOf: {
          type: "array",
          fieldNumber: 2,
          items: {
            dataType: "bytes",
          },
        },
        cancelled: {
          type: "array",
          fieldNumber: 3,
          items: {
            dataType: "bytes",
          },
        },
        guilty: {
          type: "array",
          fieldNumber: 4,
          items: {
            dataType: "bytes",
          },
        },
        joined: {
          type: "array",
          fieldNumber: 5,
          items: {
            dataType: "bytes",
          },
        },
        file: {
          type: "array",
          fieldNumber: 6,
          items: {
            dataType: "bytes",
          },
        },
        earning: {
          dataType: "uint64",
          fieldNumber: 7,
        },
        log: {
          type: "array",
          fieldNumber: 8,
          items: {
            type: "object",
            properties: {
              timestamp: {
                dataType: "uint32",
                fieldNumber: 1,
              },
              assetType: {
                dataType: "uint32",
                fieldNumber: 2,
              },
              value: {
                dataType: "uint64",
                fieldNumber: 3,
              },
              id: {
                dataType: "bytes",
                fieldNumber: 4,
              },
            },
          },
        },
      },
    },
    solver: {
      type: "object",
      fieldNumber: 4,
      properties: {
        win: {
          dataType: "uint32",
          fieldNumber: 1,
        },
        lose: {
          dataType: "uint32",
          fieldNumber: 2,
        },
        vote: {
          type: "array",
          fieldNumber: 3,
          items: {
            dataType: "bytes",
          },
        },
        earning: {
          dataType: "uint64",
          fieldNumber: 4,
        },
        log: {
          type: "array",
          fieldNumber: 5,
          items: {
            type: "object",
            properties: {
              timestamp: {
                dataType: "uint32",
                fieldNumber: 1,
              },
              assetType: {
                dataType: "uint32",
                fieldNumber: 2,
              },
              value: {
                dataType: "uint64",
                fieldNumber: 3,
              },
              id: {
                dataType: "bytes",
                fieldNumber: 4,
              },
            },
          },
        },
      },
    },
  },
  default: {
    accountType: "",
    employer: {
      done: [],
      terminated: [],
      guilty: [],
      ongoing: [],
      spent: 0,
      log: [],
    },
    worker: {
      leaderOf: [],
      contributorOf: [],
      cancelled: [],
      guilty: [],
      joined: [],
      file: [],
      earning: 0,
      log: [],
    },
    solver: {
      win: 0,
      lose: 0,
      vote: [],
      earning: 0,
      log: [],
    },
  },
};

const ProjectSchema = {
  $id: "lisk/collabolancer/project",
  type: "object",
  required: [
    "id",
    "employer",
    "title",
    "description",
    "category",
    "prize",
    "freezedFund",
    "freezedFee",
    "cashback",
    "maxTime",
    "maxRevision",
    "status",
    "statusNote",
    "submission",
    "winner",
    "guilty",
    "terminated",
    "postedOn",
    "workStarted",
    "workFinished",
    "canBeClaimedOn",
    "proposal",
    "openedDisputes",
    "closedDisputes",
    "activity",
    "commitmentFee",
  ],
  properties: {
    id: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    employer: {
      dataType: "bytes",
      fieldNumber: 2,
    },
    title: {
      dataType: "string",
      fieldNumber: 3,
    },
    description: {
      dataType: "string",
      fieldNumber: 4,
    },
    category: {
      dataType: "string",
      fieldNumber: 5,
    },
    prize: {
      dataType: "uint64",
      fieldNumber: 6,
    },
    freezedFund: {
      dataType: "uint64",
      fieldNumber: 7,
    },
    freezedFee: {
      dataType: "uint64",
      fieldNumber: 8,
    },
    cashback: {
      dataType: "uint64",
      fieldNumber: 9,
    },
    maxTime: {
      dataType: "uint32",
      fieldNumber: 10,
    },
    maxRevision: {
      dataType: "uint32",
      fieldNumber: 11,
    },
    status: {
      dataType: "string",
      fieldNumber: 12,
    },
    statusNote: {
      type: "array",
      fieldNumber: 13,
      items: {
        type: "object",
        properties: {
          time: {
            dataType: "uint32",
            fieldNumber: 1,
          },
          status: {
            dataType: "string",
            fieldNumber: 2,
          },
          submission: {
            dataType: "bytes",
            fieldNumber: 3,
          },
          reason: {
            dataType: "string",
            fieldNumber: 4,
          },
        },
      },
    },
    submission: {
      type: "array",
      fieldNumber: 14,
      items: {
        dataType: "bytes",
      },
    },
    winner: {
      dataType: "string",
      fieldNumber: 15,
    },
    guilty: {
      dataType: "boolean",
      fieldNumber: 16,
    },
    terminated: {
      dataType: "boolean",
      fieldNumber: 17,
    },
    postedOn: {
      dataType: "uint32",
      fieldNumber: 18,
    },
    workStarted: {
      dataType: "uint32",
      fieldNumber: 19,
    },
    workFinished: {
      dataType: "uint32",
      fieldNumber: 20,
    },
    canBeClaimedOn: {
      dataType: "uint32",
      fieldNumber: 21,
    },
    proposal: {
      type: "array",
      fieldNumber: 22,
      items: {
        dataType: "bytes",
      },
    },
    openedDisputes: {
      type: "array",
      fieldNumber: 23,
      items: {
        dataType: "bytes",
      },
    },
    closedDisputes: {
      type: "array",
      fieldNumber: 24,
      items: {
        dataType: "bytes",
      },
    },
    activity: {
      type: "array",
      fieldNumber: 25,
      items: {
        type: "object",
        properties: {
          timestamp: {
            dataType: "uint32",
            fieldNumber: 1,
          },
          id: {
            dataType: "bytes",
            fieldNumber: 2,
          },
          activityType: {
            dataType: "uint32",
            fieldNumber: 3,
          },
        },
      },
    },
    commitmentFee: {
      dataType: "uint64",
      fieldNumber: 26,
    },
  },
};

const ProposalSchema = {
  $id: "lisk/collabolancer/proposal",
  type: "object",
  required: [
    "id",
    "project",
    "employer",
    "leader",
    "term",
    "status",
    "guilty",
    "cancelled",
    "potentialEarning",
    "freezedFund",
    "freezedFee",
    "cashback",
    "pitching",
    "lastSubmitted",
    "team",
  ],
  properties: {
    id: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    project: {
      dataType: "bytes",
      fieldNumber: 2,
    },
    employer: {
      dataType: "string",
      fieldNumber: 3,
    },
    leader: {
      dataType: "bytes",
      fieldNumber: 4,
    },
    term: {
      type: "object",
      fieldNumber: 5,
      properties: {
        commitmentFee: {
          dataType: "uint64",
          fieldNumber: 1,
        },
        roleList: {
          type: "array",
          fieldNumber: 2,
          items: {
            dataType: "string",
          },
        },
        brief: {
          dataType: "string",
          fieldNumber: 3,
        },
        maxTime: {
          dataType: "uint32",
          fieldNumber: 4,
        },
        maxRevision: {
          dataType: "uint32",
          fieldNumber: 5,
        },
        distribution: {
          type: "object",
          fieldNumber: 6,
          properties: {
            mode: {
              dataType: "string",
              fieldNumber: 1,
            },
            value: {
              dataType: "uint32",
              fieldNumber: 2,
            },
          },
        },
      },
    },
    status: {
      dataType: "string",
      fieldNumber: 6,
    },
    guilty: {
      dataType: "boolean",
      fieldNumber: 7,
    },
    cancelled: {
      dataType: "boolean",
      fieldNumber: 8,
    },
    potentialEarning: {
      dataType: "uint64",
      fieldNumber: 9,
    },
    freezedFund: {
      dataType: "uint64",
      fieldNumber: 10,
    },
    freezedFee: {
      dataType: "uint64",
      fieldNumber: 11,
    },
    cashback: {
      dataType: "uint64",
      fieldNumber: 12,
    },
    pitching: {
      dataType: "string",
      fieldNumber: 13,
    },
    lastSubmitted: {
      dataType: "uint32",
      fieldNumber: 14,
    },
    team: {
      type: "array",
      fieldNumber: 15,
      items: {
        dataType: "bytes",
      },
    },
  },
};

const TeamSchema = {
  $id: "lisk/collabolancer/team",
  type: "object",
  required: [
    "id",
    "role",
    "leader",
    "proposal",
    "project",
    "worker",
    "freezedFund",
    "freezedFee",
    "cashback",
    "potentialEarning",
    "contribution",
    "statusNote",
    "status",
    "oldStatus",
    "forceReject",
    "forceCancel",
    "guilty",
    "lastSubmitted",
  ],
  properties: {
    id: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    role: {
      dataType: "string",
      fieldNumber: 2,
    },
    leader: {
      dataType: "bytes",
      fieldNumber: 3,
    },
    proposal: {
      dataType: "bytes",
      fieldNumber: 4,
    },
    project: {
      dataType: "bytes",
      fieldNumber: 5,
    },
    worker: {
      dataType: "bytes",
      fieldNumber: 6,
    },
    freezedFund: {
      dataType: "uint64",
      fieldNumber: 7,
    },
    freezedFee: {
      dataType: "uint64",
      fieldNumber: 8,
    },
    cashback: {
      dataType: "uint64",
      fieldNumber: 9,
    },
    potentialEarning: {
      dataType: "uint64",
      fieldNumber: 10,
    },
    contribution: {
      type: "array",
      fieldNumber: 11,
      items: {
        dataType: "bytes",
      },
    },
    statusNote: {
      type: "array",
      fieldNumber: 12,
      items: {
        type: "object",
        properties: {
          time: {
            dataType: "uint32",
            fieldNumber: 1,
          },
          status: {
            dataType: "string",
            fieldNumber: 2,
          },
          contribution: {
            dataType: "bytes",
            fieldNumber: 3,
          },
          reason: {
            dataType: "string",
            fieldNumber: 4,
          },
        },
      },
    },
    status: {
      dataType: "string",
      fieldNumber: 13,
    },
    oldStatus: {
      dataType: "string",
      fieldNumber: 14,
    },
    forceReject: {
      dataType: "boolean",
      fieldNumber: 15,
    },
    forceCancel: {
      dataType: "boolean",
      fieldNumber: 16,
    },
    guilty: {
      dataType: "boolean",
      fieldNumber: 17,
    },
    lastSubmitted: {
      dataType: "uint32",
      fieldNumber: 18,
    },
  },
};

const ContributionSchema = {
  $id: "lisk/collabolancer/contribution",
  type: "object",
  required: [
    "id",
    "owner",
    "project",
    "proposal",
    "team",
    "time",
    "extension",
    "mime",
    "filename",
    "data",
  ],
  properties: {
    id: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    owner: {
      dataType: "bytes",
      fieldNumber: 2,
    },
    project: {
      dataType: "bytes",
      fieldNumber: 3,
    },
    proposal: {
      dataType: "bytes",
      fieldNumber: 4,
    },
    team: {
      dataType: "bytes",
      fieldNumber: 5,
    },
    time: {
      dataType: "uint32",
      fieldNumber: 6,
    },
    extension: {
      dataType: "string",
      fieldNumber: 7,
    },
    mime: {
      dataType: "string",
      fieldNumber: 8,
    },
    filename: {
      dataType: "string",
      fieldNumber: 9,
    },
    data: {
      dataType: "bytes",
      fieldNumber: 10,
    },
  },
};

const SubmissionSchema = {
  $id: "lisk/collabolancer/submission",
  type: "object",
  required: [
    "id",
    "owner",
    "project",
    "proposal",
    "time",
    "extension",
    "mime",
    "filename",
    "data",
  ],
  properties: {
    id: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    owner: {
      dataType: "bytes",
      fieldNumber: 2,
    },
    project: {
      dataType: "bytes",
      fieldNumber: 3,
    },
    proposal: {
      dataType: "bytes",
      fieldNumber: 4,
    },
    time: {
      dataType: "uint32",
      fieldNumber: 5,
    },
    extension: {
      dataType: "string",
      fieldNumber: 6,
    },
    mime: {
      dataType: "string",
      fieldNumber: 7,
    },
    filename: {
      dataType: "string",
      fieldNumber: 8,
    },
    data: {
      dataType: "bytes",
      fieldNumber: 9,
    },
  },
};

const DisputeSchema = {
  $id: "lisk/collabolancer/dispute",
  type: "object",
  required: [
    "id",
    "disputeType",
    "timestamp",
    "maxDays",
    "litigant",
    "defendant",
    "project",
    "case",
    "caseType",
    "targetFundAccount",
    "targetFundAccountType",
    "suit",
    "vote",
    "score",
    "winner",
    "status",
    "freezedFund",
    "litigantFreezedFee",
    "defendantFreezedFee",
    "castVoteFee",
  ],
  properties: {
    id: {
      dataType: "bytes",
      fieldNumber: 1,
    },
    disputeType: {
      dataType: "string",
      fieldNumber: 2,
    },
    timestamp: {
      dataType: "uint32",
      fieldNumber: 3,
    },
    maxDays: {
      dataType: "uint32",
      fieldNumber: 4,
    },
    litigant: {
      dataType: "bytes",
      fieldNumber: 5,
    },
    defendant: {
      dataType: "bytes",
      fieldNumber: 6,
    },
    project: {
      dataType: "bytes",
      fieldNumber: 7,
    },
    case: {
      dataType: "bytes",
      fieldNumber: 8,
    },
    caseType: {
      dataType: "string",
      fieldNumber: 9,
    },
    targetFundAccount: {
      dataType: "bytes",
      fieldNumber: 10,
    },
    targetFundAccountType: {
      dataType: "string",
      fieldNumber: 11,
    },
    suit: {
      dataType: "string",
      fieldNumber: 12,
    },
    vote: {
      type: "object",
      fieldNumber: 13,
      properties: {
        litigant: {
          type: "array",
          fieldNumber: 1,
          items: {
            dataType: "bytes",
          },
        },
        defendant: {
          type: "array",
          fieldNumber: 2,
          items: {
            dataType: "bytes",
          },
        },
      },
    },
    score: {
      type: "object",
      fieldNumber: 14,
      properties: {
        litigant: {
          type: "array",
          fieldNumber: 1,
          items: {
            dataType: "uint64",
          },
        },
        defendant: {
          type: "array",
          fieldNumber: 2,
          items: {
            dataType: "uint64",
          },
        },
      },
    },
    winner: {
      dataType: "bytes",
      fieldNumber: 15,
    },
    status: {
      dataType: "string",
      fieldNumber: 16,
    },
    freezedFund: {
      dataType: "uint64",
      fieldNumber: 17,
    },
    litigantFreezedFee: {
      dataType: "uint64",
      fieldNumber: 18,
    },
    defendantFreezedFee: {
      dataType: "uint64",
      fieldNumber: 19,
    },
    castVoteFee: {
      dataType: "uint64",
      fieldNumber: 20,
    },
  },
};

module.exports = {
  CollabolancerAccountSchema,
  ProjectSchema,
  ProposalSchema,
  TeamSchema,
  ContributionSchema,
  SubmissionSchema,
  DisputeSchema,
};
