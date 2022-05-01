const Web3 = require("web3");
const provider = new Web3.providers.HttpProvider("http://localhost:8545");
var web3 = new Web3(provider);
const { eip712Domain, structHash, signHash } = require("./eip712.js");

// Truffle does not expose chai so it is impossible to add chai-as-promised.
// This is a simple replacement function.
// https://github.com/trufflesuite/truffle/issues/2090
const assertIsRejected = (promise, error_match, message) => {
  let passed = false;
  return promise
    .then(() => {
      passed = true;
      return assert.fail();
    })
    .catch((error) => {
      if (passed)
        return assert.fail(message || "Expected promise to be rejected");
      if (error_match) {
        if (typeof error_match === "string")
          return assert.equal(error_match, error.message, message);
        if (error_match instanceof RegExp)
          return (
            error.message.match(error_match) ||
            assert.fail(
              error.message,
              error_match.toString(),
              `'${
                error.message
              }' does not match ${error_match.toString()}: ${message}`
            )
          );
        return assert.instanceOf(error, error_match, message);
      }
    });
};

const increaseTime = (seconds) => {
  return new Promise((resolve) =>
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds],
        id: 0,
      },
      resolve
    )
  );
};

const eip712Order = {
  name: "Order",
  fields: [
    { name: "registry", type: "address" },
    { name: "maker", type: "address" },
    { name: "staticTarget", type: "address" },
    { name: "staticSelector", type: "bytes4" },
    { name: "staticExtradata", type: "bytes" },
    { name: "maximumFill", type: "uint256" },
    { name: "listingTime", type: "uint256" },
    { name: "expirationTime", type: "uint256" },
    { name: "salt", type: "uint256" },
  ],
};

web3 = web3.extend({
  methods: [
    {
      name: "signTypedData",
      call: "eth_signTypedData",
      params: 2,
      inputFormatter: [web3.extend.formatters.inputAddressFormatter, null],
    },
  ],
});

const hashOrder = (order) => {
  return structHash(eip712Order.name, eip712Order.fields, order).toString(
    "hex"
  );
};

const structToSign = (order, exchange) => {
  return {
    name: eip712Order.name,
    fields: eip712Order.fields,
    domain: {
      name: "OasisX Exchange",
      version: "1.0",
      chainId: 1337,
      verifyingContract: exchange,
    },
    data: order,
  };
};

const hashToSign = (order, exchange, prefix = "") => {
  return signHash(
    structToSign(order, exchange),
    prefix != "" ? prefix : "0x1901"
  ).toString("hex");
};

const parseSig = (bytes) => {
  bytes = bytes.substr(2);
  const r = "0x" + bytes.slice(0, 64);
  const s = "0x" + bytes.slice(64, 128);
  const v = parseInt("0x" + bytes.slice(128, 130), 16);
  return { v, r, s };
};

const wrap = (inst) => {
  var obj = {
    inst: inst,
    hashOrder: (order) =>
      inst.hashOrder.call(
        order.registry,
        order.maker,
        order.staticTarget,
        order.staticSelector,
        order.staticExtradata,
        order.maximumFill,
        order.listingTime,
        order.expirationTime,
        order.salt
      ),
    hashToSign: (order) => {
      return inst.hashOrder
        .call(
          order.registry,
          order.maker,
          order.staticTarget,
          order.staticSelector,
          order.staticExtradata,
          order.maximumFill,
          order.listingTime,
          order.expirationTime,
          order.salt
        )
        .then((hash) => {
          return inst.hashToSign.call(hash);
        });
    },
    validateOrderParameters: (order) =>
      inst.validateOrderParameters.call(
        order.registry,
        order.maker,
        order.staticTarget,
        order.staticSelector,
        order.staticExtradata,
        order.maximumFill,
        order.listingTime,
        order.expirationTime,
        order.salt
      ),
    validateOrderAuthorization: (hash, maker, sig, misc) =>
      inst.validateOrderAuthorization.call(
        hash,
        maker,
        web3.eth.abi.encodeParameters(
          ["uint8", "bytes32", "bytes32"],
          [sig.v, sig.r, sig.s]
        ) + (sig.suffix || ""),
        misc
      ),
    approveOrderHash: (hash) => inst.approveOrderHash(hash),
    approveOrder: (order, inclusion, misc) =>
      inst.approveOrder(
        order.registry,
        order.maker,
        order.staticTarget,
        order.staticSelector,
        order.staticExtradata,
        order.maximumFill,
        order.listingTime,
        order.expirationTime,
        order.salt,
        inclusion,
        misc
      ),
    setOrderFill: (order, fill) => inst.setOrderFill(hashOrder(order), fill),
    atomicMatch: (
      order,
      sig,
      call,
      counterorder,
      countersig,
      countercall,
      metadata
    ) =>
      inst.atomicMatch(
        [
          order.registry,
          order.maker,
          order.staticTarget,
          order.maximumFill,
          order.listingTime,
          order.expirationTime,
          order.salt,
          call.target,
          counterorder.registry,
          counterorder.maker,
          counterorder.staticTarget,
          counterorder.maximumFill,
          counterorder.listingTime,
          counterorder.expirationTime,
          counterorder.salt,
          countercall.target,
        ],
        [order.staticSelector, counterorder.staticSelector],
        order.staticExtradata,
        call.data,
        counterorder.staticExtradata,
        countercall.data,
        [call.howToCall, countercall.howToCall],
        metadata,
        web3.eth.abi.encodeParameters(
          ["bytes", "bytes"],
          [
            web3.eth.abi.encodeParameters(
              ["uint8", "bytes32", "bytes32"],
              [sig.v, sig.r, sig.s]
            ) + (sig.suffix || ""),
            web3.eth.abi.encodeParameters(
              ["uint8", "bytes32", "bytes32"],
              [countersig.v, countersig.r, countersig.s]
            ) + (countersig.suffix || ""),
          ]
        )
      ),
    atomicMatchWith: (
      order,
      sig,
      call,
      counterorder,
      countersig,
      countercall,
      metadata,
      misc
    ) =>
      inst.atomicMatch(
        [
          order.registry,
          order.maker,
          order.staticTarget,
          order.maximumFill,
          order.listingTime,
          order.expirationTime,
          order.salt,
          call.target,
          counterorder.registry,
          counterorder.maker,
          counterorder.staticTarget,
          counterorder.maximumFill,
          counterorder.listingTime,
          counterorder.expirationTime,
          counterorder.salt,
          countercall.target,
        ],
        [order.staticSelector, counterorder.staticSelector],
        order.staticExtradata,
        call.data,
        counterorder.staticExtradata,
        countercall.data,
        [call.howToCall, countercall.howToCall],
        metadata,
        web3.eth.abi.encodeParameters(
          ["bytes", "bytes"],
          [
            web3.eth.abi.encodeParameters(
              ["uint8", "bytes32", "bytes32"],
              [sig.v, sig.r, sig.s]
            ) + (sig.suffix || ""),
            web3.eth.abi.encodeParameters(
              ["uint8", "bytes32", "bytes32"],
              [countersig.v, countersig.r, countersig.s]
            ) + (countersig.suffix || ""),
          ]
        ),
        misc
      ),
  };
  obj.sign = (order, account) => {
    const str = structToSign(order, inst.address);
    return web3
      .signTypedData(account, {
        types: {
          EIP712Domain: eip712Domain.fields,
          Order: eip712Order.fields,
        },
        domain: str.domain,
        primaryType: "Order",
        message: order,
      })
      .then((sigBytes) => {
        const sig = parseSig(sigBytes);
        return sig;
      });
  };
  obj.personalSign = (order, account, prefix = "") => {
    const calculatedHashToSign = hashToSign(order, inst.address, prefix);
    return web3.eth.sign(calculatedHashToSign, account).then((sigBytes) => {
      let sig = parseSig(sigBytes);
      sig.v += 27;
      sig.suffix = "03"; // EthSign suffix like 0xProtocol
      return sig;
    });
  };
  return obj;
};

const randomUint = () => {
  return Math.floor(Math.random() * 1e10);
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const NULL_SIG = { v: 27, r: ZERO_BYTES32, s: ZERO_BYTES32 };
const CHAIN_ID = 1337;

module.exports = {
  hashOrder,
  hashToSign,
  increaseTime,
  assertIsRejected,
  wrap,
  randomUint,
  ZERO_ADDRESS,
  ZERO_BYTES32,
  NULL_SIG,
  CHAIN_ID,
};
