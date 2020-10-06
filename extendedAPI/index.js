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
      res.status(500).send({ data: err.toString() });
    });
});

extendedAPI.get("/api/project/available", (req, res) => {
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
      res.status(500).send({ data: err.toString() });
    });
});

extendedAPI.get("/api/project/unavailable", (req, res) => {
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
      res.status(500).send({ data: err.toString() });
    });
});

// TODO: /api/dispute
// TODO: /api/dispute/open
// TODO: /api/dispute/closed
// TODO: /api/proposal?project=id
// TODO: /api/team?project=id
// TODO: /api/contribution?project=id
// TODO: /api/packed?project=id
// TODO: /api/file?owner=id

extendedAPI.get("/", (req, res) => {
  res.send({ msg: "extendedAPI for Collabolancer, access /api" });
});

module.exports = { extendedAPI };
