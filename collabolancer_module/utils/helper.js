const MISCELLANEOUS = require("../constants/miscellaneous");

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const deflationaryMultiplier = async () => {
  let height = 0;
  await fetch("http://localhost:4000/api/node/info").then((data) => {
    height = data.data.height;
  });
  let multiplier = 100;
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

module.exports = { asyncForEach, deflationaryMultiplier };
