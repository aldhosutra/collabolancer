const { getStateCenterAccount } = require("../transactions/utils");
const { APIClient } = require("@liskhq/lisk-api-client");
const api = new APIClient(["http://localhost:4000"]);
const { getAddressFromPublicKey } = require("@liskhq/lisk-cryptography");
const {
  category,
  STATUS,
  ACCOUNT,
  MISCELLANEOUS,
} = require("../transactions/constants");
const base91 = require("node-base91");

const express = require("express");
const extendedAPI = express();

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

extendedAPI.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

extendedAPI.get("/api/constant/account", (req, res) => {
  res.status(200).send({ ACCOUNT });
});

extendedAPI.get("/api/constant/category", (req, res) => {
  res.status(200).send({ category });
});

extendedAPI.get("/api/constant/miscellaneous", (req, res) => {
  res.status(200).send({ MISCELLANEOUS });
});

extendedAPI.get("/api/constant/status", (req, res) => {
  res.status(200).send({ STATUS });
});

extendedAPI.get("/api/project", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    api.accounts
      .get({ address: getStateCenterAccount().address })
      .then(async (data) => {
        const state = data.data[0];
        const available =
          state.asset.available && state.asset.available.projects
            ? state.asset.available.projects
            : [];
        const unavailable =
          state.asset.unavailable && state.asset.unavailable.projects
            ? state.asset.unavailable.projects
            : [];
        const project = available
          .concat(unavailable)
          .slice(offset, offset + limit);
        const parsedProject = [];
        await asyncForEach(project, async (item) => {
          await api.accounts
            .get({ address: getAddressFromPublicKey(item) })
            .then((projectData) => {
              parsedProject.push(projectData.data[0]);
            });
        });
        res.status(200).send({
          meta: {
            offset: offset,
            limit: limit,
            count: available.length + unavailable.length,
          },
          data: parsedProject,
        });
      })
      .catch((err) => {
        res.status(500).send({
          meta: { offset: offset, limit: limit, count: 0, err: err.toString() },
          data: [],
        });
      });
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/project/available", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    api.accounts
      .get({ address: getStateCenterAccount().address })
      .then(async (data) => {
        const state = data.data[0];
        const available =
          state.asset.available && state.asset.available.projects
            ? state.asset.available.projects
            : [];
        const project = available.slice(offset, offset + limit);
        const parsedProject = [];
        await asyncForEach(project, async (item) => {
          await api.accounts
            .get({ address: getAddressFromPublicKey(item) })
            .then((projectData) => {
              parsedProject.push(projectData.data[0]);
            });
        });
        res.status(200).send({
          meta: {
            offset: offset,
            limit: limit,
            count: available.length,
          },
          data: parsedProject,
        });
      })
      .catch((err) => {
        res.status(500).send({
          meta: { offset: offset, limit: limit, count: 0, err: err.toString() },
          data: [],
        });
      });
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/project/unavailable", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    api.accounts
      .get({ address: getStateCenterAccount().address })
      .then(async (data) => {
        const state = data.data[0];
        const unavailable =
          state.asset.unavailable && state.asset.unavailable.projects
            ? state.asset.unavailable.projects
            : [];
        const project = unavailable.slice(offset, offset + limit);
        const parsedProject = [];
        await asyncForEach(project, async (item) => {
          await api.accounts
            .get({ address: getAddressFromPublicKey(item) })
            .then((projectData) => {
              parsedProject.push(projectData.data[0]);
            });
        });
        res.status(200).send({
          meta: {
            offset: offset,
            limit: limit,
            count: unavailable.length,
          },
          data: parsedProject,
        });
      })
      .catch((err) => {
        res.status(500).send({
          meta: { offset: offset, limit: limit, count: 0, err: err.toString() },
          data: [],
        });
      });
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/disputes", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    api.accounts
      .get({ address: getStateCenterAccount().address })
      .then(async (data) => {
        const state = data.data[0];
        const available =
          state.asset.available && state.asset.available.disputes
            ? state.asset.available.disputes
            : [];
        const unavailable =
          state.asset.unavailable && state.asset.unavailable.disputes
            ? state.asset.unavailable.disputes
            : [];
        const disputes = available
          .concat(unavailable)
          .slice(offset, offset + limit);
        const parsedDisputes = [];
        await asyncForEach(disputes, async (item) => {
          await api.accounts
            .get({ address: getAddressFromPublicKey(item) })
            .then((projectData) => {
              parsedDisputes.push(projectData.data[0]);
            });
        });
        res.status(200).send({
          meta: {
            offset: offset,
            limit: limit,
            count: available.length + unavailable.length,
          },
          data: parsedDisputes,
        });
      })
      .catch((err) => {
        res.status(500).send({
          meta: { offset: offset, limit: limit, count: 0, err: err.toString() },
          data: [],
        });
      });
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/disputes/open", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    api.accounts
      .get({ address: getStateCenterAccount().address })
      .then(async (data) => {
        const state = data.data[0];
        const available =
          state.asset.available && state.asset.available.disputes
            ? state.asset.available.disputes
            : [];
        const disputes = available.slice(offset, offset + limit);
        const parsedDisputes = [];
        await asyncForEach(disputes, async (item) => {
          await api.accounts
            .get({ address: getAddressFromPublicKey(item) })
            .then((projectData) => {
              parsedDisputes.push(projectData.data[0]);
            });
        });
        res.status(200).send({
          meta: {
            offset: offset,
            limit: limit,
            count: available.length,
          },
          data: parsedDisputes,
        });
      })
      .catch((err) => {
        res.status(500).send({
          meta: { offset: offset, limit: limit, count: 0, err: err.toString() },
          data: [],
        });
      });
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/disputes/close", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    api.accounts
      .get({ address: getStateCenterAccount().address })
      .then(async (data) => {
        const state = data.data[0];
        const unavailable =
          state.asset.unavailable && state.asset.unavailable.disputes
            ? state.asset.unavailable.disputes
            : [];
        const disputes = unavailable.slice(offset, offset + limit);
        const parsedDisputes = [];
        await asyncForEach(disputes, async (item) => {
          await api.accounts
            .get({ address: getAddressFromPublicKey(item) })
            .then((projectData) => {
              parsedDisputes.push(projectData.data[0]);
            });
        });
        res.status(200).send({
          meta: {
            offset: offset,
            limit: limit,
            count: unavailable.length,
          },
          data: parsedDisputes,
        });
      })
      .catch((err) => {
        res.status(500).send({
          meta: { offset: offset, limit: limit, count: 0, err: err.toString() },
          data: [],
        });
      });
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/proposal", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const projectPublicKey = req.query.project ? req.query.project : null;
    if (projectPublicKey) {
      api.accounts
        .get({ address: getAddressFromPublicKey(projectPublicKey) })
        .then(async (data) => {
          const proposalList = data.data[0].asset.proposal;
          const proposal = proposalList.slice(offset, offset + limit);
          const parsedProposals = [];
          await asyncForEach(proposal, async (item) => {
            await api.accounts
              .get({ address: getAddressFromPublicKey(item) })
              .then((proposalData) => {
                parsedProposals.push(proposalData.data[0]);
              });
          });
          res.status(200).send({
            meta: {
              offset: offset,
              limit: limit,
              count: proposalList.length,
            },
            data: parsedProposals,
          });
        })
        .catch((err) => {
          res.status(500).send({
            meta: {
              offset: offset,
              limit: limit,
              count: 0,
              err: err.toString(),
            },
            data: [],
          });
        });
    } else {
      res.status(500).send({
        meta: {
          offset: offset,
          limit: limit,
          count: 0,
          err: "project parameter is required",
        },
        data: [],
      });
    }
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/submission", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const full =
      req.query.full && req.query.full.toLowerCase() == "true" ? true : false;
    const projectPublicKey = req.query.project ? req.query.project : null;
    if (projectPublicKey) {
      api.accounts
        .get({ address: getAddressFromPublicKey(projectPublicKey) })
        .then(async (data) => {
          const submissionList = data.data[0].asset.submission;
          const submission = submissionList.slice(offset, offset + limit);
          const parsedSubmission = [];
          await asyncForEach(submission, async (item) => {
            await api.accounts
              .get({ address: getAddressFromPublicKey(item) })
              .then(async (submissionData) => {
                const parsedData = submissionData.data[0];
                if (full) {
                  await api.transactions
                    .get({ id: parsedData.asset.dataTransaction })
                    .then((fileDataTransaction) => {
                      parsedData.asset.fullData =
                        fileDataTransaction.data[0].asset.filedata;
                    });
                }
                parsedSubmission.push(parsedData);
              });
          });
          res.status(200).send({
            meta: {
              offset: offset,
              limit: limit,
              count: submissionList.length,
            },
            data: parsedSubmission,
          });
        })
        .catch((err) => {
          res.status(500).send({
            meta: {
              offset: offset,
              limit: limit,
              count: 0,
              err: err.toString(),
            },
            data: [],
          });
        });
    } else {
      res.status(500).send({
        meta: {
          offset: offset,
          limit: limit,
          count: 0,
          err: "project parameter is required",
        },
        data: [],
      });
    }
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/file", (req, res) => {
  try {
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const full =
      req.query.full && req.query.full.toLowerCase() == "true" ? true : false;
    const ownerPublicKey = req.query.owner ? req.query.owner : null;
    if (ownerPublicKey) {
      api.accounts
        .get({ address: getAddressFromPublicKey(ownerPublicKey) })
        .then(async (data) => {
          const fileList = data.data[0].asset.file;
          const file = fileList.slice(offset, offset + limit);
          const parsedFile = [];
          await asyncForEach(file, async (item) => {
            await api.accounts
              .get({ address: getAddressFromPublicKey(item) })
              .then(async (fileData) => {
                const parsedData = fileData.data[0];
                if (full) {
                  await api.transactions
                    .get({ id: parsedData.asset.dataTransaction })
                    .then((fileDataTransaction) => {
                      parsedData.asset.fullData =
                        fileDataTransaction.data[0].asset.filedata;
                    });
                }
                parsedFile.push(parsedData);
              });
          });
          res.status(200).send({
            meta: {
              offset: offset,
              limit: limit,
              count: fileList.length,
            },
            data: parsedFile,
          });
        })
        .catch((err) => {
          res.status(500).send({
            meta: {
              offset: offset,
              limit: limit,
              count: 0,
              err: err.toString(),
            },
            data: [],
          });
        });
    } else {
      res.status(500).send({
        meta: {
          offset: offset,
          limit: limit,
          count: 0,
          err: "owner parameter is required",
        },
        data: [],
      });
    }
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/packed", (req, res) => {
  try {
    const full =
      req.query.full && req.query.full.toLowerCase() == "true" ? true : false;
    const projectPublicKey = req.query.project ? req.query.project : null;
    const parsed =
      req.query.parsed && req.query.parsed == "false" ? false : true;
    if (projectPublicKey) {
      api.accounts
        .get({ address: getAddressFromPublicKey(projectPublicKey) })
        .then(async (data) => {
          const project = data.data[0];
          if (parsed) {
            const parsedSubmission = [];
            const parsedProposal = [];
            const parsedOpenedDisputes = [];
            const parsedClosedDisputes = [];
            await asyncForEach(project.asset.submission, async (item) => {
              await api.accounts
                .get({ address: getAddressFromPublicKey(item) })
                .then(async (submissionData) => {
                  const parsedData = submissionData.data[0];
                  if (full) {
                    await api.transactions
                      .get({ id: parsedData.asset.dataTransaction })
                      .then((fileDataTransaction) => {
                        parsedData.asset.fullData =
                          fileDataTransaction.data[0].asset.filedata;
                      });
                  }
                  parsedSubmission.push(parsedData);
                });
            });
            await asyncForEach(project.asset.proposal, async (item) => {
              await api.accounts
                .get({ address: getAddressFromPublicKey(item) })
                .then(async (proposalData) => {
                  const parsedData = proposalData.data[0];
                  const parsedTeam = [];
                  await asyncForEach(
                    parsedData.asset.team,
                    async (teamItem) => {
                      if (teamItem != 0) {
                        await api.accounts
                          .get({ address: getAddressFromPublicKey(teamItem) })
                          .then(async (teamData) => {
                            const parsedTeamData = teamData.data[0];
                            const parsedContributionData = [];
                            await asyncForEach(
                              parsedTeamData.asset.contribution,
                              async (contributionItem) => {
                                await api.accounts
                                  .get({
                                    address: getAddressFromPublicKey(
                                      contributionItem
                                    ),
                                  })
                                  .then(async (contributionData) => {
                                    const fullContributionData =
                                      contributionData.data[0];
                                    if (full) {
                                      await api.transactions
                                        .get({
                                          id:
                                            fullContributionData.asset
                                              .dataTransaction,
                                        })
                                        .then((fileDataTransaction) => {
                                          fullContributionData.asset.fullData =
                                            fileDataTransaction.data[0].asset.filedata;
                                        });
                                    }
                                    parsedContributionData.push(
                                      fullContributionData
                                    );
                                  });
                              }
                            );
                            parsedTeamData.asset.contribution = parsedContributionData;
                            parsedTeam.push(parsedTeamData);
                          });
                      } else {
                        parsedTeam.push(0);
                      }
                    }
                  );
                  parsedData.asset.team = parsedTeam;
                  parsedProposal.push(parsedData);
                });
            });
            await asyncForEach(project.asset.openedDisputes, async (item) => {
              await api.accounts
                .get({ address: getAddressFromPublicKey(item) })
                .then(async (openedDisputesData) => {
                  parsedOpenedDisputes.push(openedDisputesData.data[0]);
                });
            });
            await asyncForEach(project.asset.closedDisputes, async (item) => {
              await api.accounts
                .get({ address: getAddressFromPublicKey(item) })
                .then(async (closedDisputesData) => {
                  parsedClosedDisputes.push(closedDisputesData.data[0]);
                });
            });
            project.asset.submission = parsedSubmission;
            project.asset.proposal = parsedProposal;
            project.asset.openedDisputes = parsedOpenedDisputes;
            project.asset.closedDisputes = parsedClosedDisputes;
          }
          res.status(200).send({
            meta: {
              submission: project.asset.submission.length,
              proposal: project.asset.proposal.length,
              openedDisputes: project.asset.openedDisputes.length,
              closedDisputes: project.asset.closedDisputes.length,
              activity: project.asset.activity.length,
            },
            data: [project],
          });
        })
        .catch((err) => {
          res.status(500).send({
            meta: {
              submission: 0,
              proposal: 0,
              openedDisputes: 0,
              closedDisputes: 0,
              activity: 0,
              err: err.toString(),
            },
            data: [],
          });
        });
    } else {
      res.status(500).send({
        meta: {
          submission: 0,
          proposal: 0,
          openedDisputes: 0,
          closedDisputes: 0,
          activity: 0,
          err: "project parameter is required",
        },
        data: [],
      });
    }
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/api/file/:id", async (req, res) => {
  try {
    let fileData = null;
    let type = "";
    let title = "";
    const filePublicKey = req.params.id;

    await api.accounts
      .get({ address: getAddressFromPublicKey(filePublicKey) })
      .then(async (data) => {
        title = data.data[0].asset.filename;
        type = data.data[0].asset.mime;
        await api.transactions
          .get({ id: data.data[0].asset.dataTransaction })
          .then((file) => {
            fileData = file.data[0].asset.filedata;
          });
      });

    const arrayBuffer = base91.decode(fileData);
    var data = Buffer.from(arrayBuffer);
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": data.length,
      "Content-Disposition": `inline; filename=${title}`,
    });
    res.end(data);
  } catch (err) {
    res.status(500).send({
      meta: { err: err.toString() },
      data: [],
    });
  }
});

extendedAPI.get("/", (req, res) => {
  res.send({ msg: "extendedAPI for Collabolancer, access /api" });
});

module.exports = { extendedAPI };
