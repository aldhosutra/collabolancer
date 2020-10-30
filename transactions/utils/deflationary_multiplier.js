const { MISCELLANEOUS } = require("../constants");
const { APIClient } = require("@liskhq/lisk-api-client");
const api = new APIClient(["http://localhost:4000"]);

const deflationaryMultiplier = async () => {
  let height = 0;
  await api.node.getStatus().then((data) => {
    height = data.data.height;
  });
  let multiplier = 1.0;
  for (
    let i = 0;
    i < MISCELLANEOUS.CASHBACK_DEFLATIONARY_MILESTONE.length;
    i++
  ) {
    if (height < MISCELLANEOUS.CASHBACK_DEFLATIONARY_MILESTONE[i]) {
      break;
    } else {
      multiplier = multiplier / 2;
    }
  }
  return multiplier;
};

module.exports = deflationaryMultiplier;
