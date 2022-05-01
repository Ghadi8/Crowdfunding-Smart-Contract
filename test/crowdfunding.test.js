const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

// chai assert
const { assert } = chai;

// chai promises
chai.use(chaiAsPromised);

// load contract artifact
const Crowdfunding = artifacts.require("Crowdfunding");

contract("Crowdfunding", (accounts) => {
  let txStack = [];
  const deploy = async (contracts) =>
    Promise.all(contracts.map((contract) => contract.deployed()));

  const withContracts = async () => {
    let [crowdfunding] = await deploy([Crowdfunding]);
    return {
      crowdfunding,
    };
  };

  it("user can create a crowdfunding project", async () => {
    let { crowdfunding } = await withContracts();
    let tx = await crowdfunding.createProject("Test", "Test project", {
      from: accounts[0],
    });

    txStack.push(tx);
  });

  it("same user can create multiple projects", async () => {
    let { crowdfunding } = await withContracts();
    let tx = await crowdfunding.createProject("Test2", "Second test project", {
      from: accounts[0],
    });

    txStack.push(tx);
  });

  it("owner cannot donate to his own projects", async () => {
    let { crowdfunding } = await withContracts();
    let tx = await crowdfunding
      .participateToProject(0, {
        from: accounts[0],
        value: 1,
      })
      .then(() => {
        assert.fail("owner shouldnt be able to donate to his project");
      })
      .catch((r) => {
        assert.ok("owner was not able to donate to his project");
        return r;
      });
    txStack.push(tx);
  });

  it("user can donate to a project", async () => {
    let { crowdfunding } = await withContracts();
    let tx = await crowdfunding.participateToProject(0, {
      from: accounts[1],
      value: 3,
    });
    txStack.push(tx);
  });

  it("same user can donate again to same project", async () => {
    let { crowdfunding } = await withContracts();
    let tx = await crowdfunding.participateToProject(0, {
      from: accounts[1],
      value: 5,
    });
    txStack.push(tx);
  });

  it("another user can donate to same project", async () => {
    let { crowdfunding } = await withContracts();
    let tx = await crowdfunding.participateToProject(0, {
      from: accounts[3],
      value: 1,
    });
    txStack.push(tx);
  });

  it("any user can retrieve the details of a project", async () => {
    let { crowdfunding } = await withContracts();
    let tx = await crowdfunding.searchForProject(0, { from: accounts[2] });
    assert.equal(tx[0], "0");
    assert.equal(tx[1], "Test");
    assert.equal(tx[2], "Test project");
    assert.equal(tx[3], accounts[0]);
    assert.equal(tx[4], 9);
    txStack.push(tx);
  });

  it("user should be able to retrieve total donations done by specific address", async () => {
    let { crowdfunding } = await withContracts();
    let tx = await crowdfunding.getContributions(0, accounts[1], {
      from: accounts[2],
    });
    assert.equal(tx[0], accounts[1]);
    assert.equal(tx[1], 8);
  });
});
