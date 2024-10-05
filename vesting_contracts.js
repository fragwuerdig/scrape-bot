const common = require('./common');
const axios = require('axios');

const PUBLICNODE = 'https://terra-classic-lcd.publicnode.com';
const DMZ = common.LockDropContract;
const VESTING = common.VestingContract;

// get the lockdrop distribution weights (all of them)
getWeights = async function () {

    const queryData = {weights: {}};
    const queryDataJson = JSON.stringify(queryData);
    const queryDataBase64 = Buffer.from(queryDataJson).toString('base64');
    const url = `${PUBLICNODE}/cosmwasm/wasm/v1/contract/${DMZ}/smart/${queryDataBase64}`;
    try {
        const response = await axios.get(url);
        const data = response.data.data;
        const objectified = data.map(d => {return {address: d[0], weight: Number(d[1])} });
        return objectified
    } catch (err) {
        console.log('Could not Fetch weights')
        console.log(err)
        return undefined;
    }
    
}

// get how much a (specific) account can currently claim from the DMZ contract
getClaim = async function (account) {

    const queryData = {claim: {address: account}};
    const queryDataJson = JSON.stringify(queryData);
    const queryDataBase64 = Buffer.from(queryDataJson).toString('base64');
    const url = `${PUBLICNODE}/cosmwasm/wasm/v1/contract/${DMZ}/smart/${queryDataBase64}`;
    try {
        const response = await axios.get(url);
        return Number(response.data.data);
    } catch (err) {
        console.log('Could not Fetch claim')
        console.log(err)
        return undefined;
    }

}

// get the total vest amount for all accounts (like, ever)
getTotalVest = async function () {
    
    const queryData = {total_to_vest:{}};
    const queryDataJson = JSON.stringify(queryData);
    const queryDataBase64 = Buffer.from(queryDataJson).toString('base64');
    const url = `${PUBLICNODE}/cosmwasm/wasm/v1/contract/${VESTING}/smart/${queryDataBase64}`;
    try {
        const response = await axios.get(url);
        return Number(response.data.data);
    } catch (err) {
        console.log('Could not Fetch total vest')
        console.log(err)
        return undefined;
    }
    
}

exports.getWeights = getWeights;
exports.getClaim = getClaim;
exports.getTotalVest = getTotalVest;