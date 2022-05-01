const CrowdfundingCont = artifacts.require("Crowdfunding");

const { setEnvValue } = require("../utils/env-man");

const conf = require("../migration-parameters");

const setCrowdfunding = (n, v) => {
  setEnvValue("../", `Crowdfunding_ADDRESS_${n.toUpperCase()}`, v);
};

module.exports = async (deployer, network, accounts) => {
  switch (network) {
    case "rinkeby":
      c = { ...conf.rinkeby };
      break;
    case "mainnet":
      c = { ...conf.mainnet };
      break;
    case "development":
    default:
      c = { ...conf.devnet };
  }

  // deploy Crowdfunding
  await deployer.deploy(CrowdfundingCont);

  const Crowdfunding = await CrowdfundingCont.deployed();

  if (Crowdfunding) {
    console.log(
      `Deployed: Crowdfunding
       network: ${network}
       address: ${Crowdfunding.address}
       creator: ${accounts[0]}
    `
    );
    setCrowdfunding(network, Crowdfunding.address);
  } else {
    console.log("Crowdfunding Deployment UNSUCCESSFUL");
  }
};
