const {
  RPCSubprovider,
  Web3ProviderEngine,
} = require('@0x/subproviders');

const { generatePseudoRandomSalt, Order, orderHashUtils, signatureUtils, SignedOrder, assetDataUtils, orderUtils } = require('@0x/order-utils');
const { ContractWrappers } = require('@0x/contract-wrappers');
const { Web3Wrapper } = require('@0x/web3-wrapper');
const { BigNumber } = require('@0x/utils');

const AssetDataUtils = artifacts.require('AssetDataUtils');
const FakeToken = artifacts.require('FakeToken');
const CollateralToken = artifacts.require('CollateralToken');
const MinterBridge = artifacts.require('MinterBridge');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

module.exports = async function() {
  try {
    // const rpcSubprovider = new RPCSubprovider('http://localhost:8545');
    //const provider = new Web3ProviderEngine();
    //provider.addProvider(web3.currentProvider);
    // provider.addProvider(rpcSubprovider);
    //provider.start();

    const provider = web3.currentProvider;

    // Then use the provider
    const chainId = 42;
    const contractWrappers = new ContractWrappers(provider, { chainId });
    const web3Wrapper = new Web3Wrapper(provider);

    const fakeToken = await FakeToken.deployed();
    const collateralToken = await CollateralToken.deployed();
    const minterBridge = await MinterBridge.deployed();

    const addresses = await web3Wrapper.getAvailableAddressesAsync();
    const makerAddress = addresses[0];
    const takerAddress = addresses[1];

    // Fake token
    const makerToken = {address: fakeToken.address, decimals: 18};
    // We use CollateralToken here (in real life this will be USDC)
    const takerToken = {address: collateralToken.address, decimals: 18};
    // Encode the selected makerToken as assetData for 0x
    const makerAssetData = assetDataUtils.encodeERC20BridgeAssetData(makerToken.address, minterBridge.address, '0x0000');
    const decodedAssetData = assetDataUtils.decodeAssetDataOrThrow(makerAssetData)
    // Encode the selected takerToken as assetData for 0x
    const takerAssetData = await contractWrappers.devUtils.encodeERC20AssetData(takerToken.address).callAsync();
    // Amounts are in Unit amounts, 0x requires base units (as many tokens use decimals)
    const makerAssetAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(2), 0);
    const takerAssetAmount = Web3Wrapper.toBaseUnitAmount(new BigNumber(1), 0);
    const exchangeAddress = contractWrappers.exchange.address;

    if (false) {
      await collateralToken
      .approve(contractWrappers.contractAddresses.erc20Proxy, new BigNumber(10).pow(256).minus(1), { from:  takerAddress });
    }

    const order = {
      makerAddress, // maker is the first address
      takerAddress: NULL_ADDRESS, // taker is open and can be filled by anyone
      makerAssetAmount, // The maker asset amount
      takerAssetAmount, // The taker asset amount
      expirationTimeSeconds: new BigNumber(Math.round(Date.now() / 1000) + 30 * 24 * 60 * 60), // Time when this order expires
      makerFee: 0, // 0 maker fees
      takerFee: 0, // 0 taker fees
      feeRecipientAddress: NULL_ADDRESS, // No fee recipient
      senderAddress: NULL_ADDRESS, // Sender address is open and can be submitted by anyone
      salt: generatePseudoRandomSalt(), // Random value to provide uniqueness
      makerAssetData,
      takerAssetData,
      exchangeAddress,
      makerFeeAssetData: '0x',
      takerFeeAssetData: '0x',
      chainId,
    };

    const signedOrder = await signatureUtils.ecSignOrderAsync(provider, order, makerAddress);
    console.log('signedOrder:', JSON.stringify(signedOrder));

    console.log('contractWrappers.exchange', contractWrappers.exchange.address)

    return
    // Fill order
    const txHash = await contractWrappers.exchange
      .fillOrder(signedOrder, makerAssetAmount, signedOrder.signature)
      .sendTransactionAsync({ from: takerAddress, gas: 6700000, value: 3000000000000000 }); // value is required to pay 0x fees
    console.log('txHash:', txHash);
  } catch(e) {
    console.log(e);
  }

  process.exit();
}