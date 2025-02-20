const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.SCRAPE_STAKERS_BASE_URL;
if (!BASE_URL) {
    console.log('BASE_URL_SCRAPE_STAKERS is not set')
    process.exit(1);
}

const VALIDATOR = process.env.SCRAPE_STAKERS_VALIDATOR;
if (!VALIDATOR) {
    console.log('VALIDATOR is not set')
    process.exit(1);
}

if (! process.env.DB_USER || ! process.env.DB_HOST || ! process.env.DB_NAME || ! process.env.DB_PASS || ! process.env.DB_PORT) {
    console.log('DB credentials are not set')
    process.exit(1);
}

const getTotalAmount = async (delegators_in) => {
    const delegators = delegators_in.map(delegator => delegator.amount);
    const total = delegators.reduce((sum, amount) => sum + amount, 0);
    return total;
}

const doSafetyShot = async () => {

    var amnt = [];
    for (let i = 0; i < 10; i++) {
        getTotalAmount(delegators);
        amnt.push(delegatorsSum);
    }
    console.log(amnt);

}

const fetchDelegations = async () => {
    const url = `${BASE_URL}/cosmos/staking/v1beta1/validators/${VALIDATOR}/delegations`;
    var all_delegations = [];
    var offset = 1;
    var limit = 100;

    while (true) {
        try {
            const response = await axios.get(url + `?pagination.limit=${limit}&pagination.offset=${offset}`);
            delegations = response.data.delegation_responses;
            if (delegations.length == 0) {
                break;
            }
            all_delegations.push(...delegations);
            all_delegations = all_delegations.flat();
            offset += limit;
        } catch (err) {
            console.log('Could not Fetch delegators')
            console.log(err)
            return undefined;
        }
    }

    var all_delegations_mapped = all_delegations.map(delegation => {
        return{address: delegation.delegation.delegator_address, amount: Number(delegation.balance.amount)}
    })
    console.log(all_delegations_mapped)
    console.log(all_delegations_mapped.length)

    var map_delegators_to_amount = new Map();
    all_delegations_mapped.forEach((delegation) => {
        if (map_delegators_to_amount.has(delegation.address)) {
            map_delegators_to_amount.set(delegation.address, map_delegators_to_amount.get(delegation.address) + delegation.amount)
        } else {
            map_delegators_to_amount.set(delegation.address, delegation.amount)
        }
    })

    return map_delegators_to_amount

}

const newSnapshot = async (client) => {
    const timestamp = new Date().toISOString();
    const query = `INSERT INTO snapshots_delegators (created) VALUES ('${timestamp}') RETURNING id`;
    const result = await client.query(query);
    const autoIdx = result.rows[0].id;
    return autoIdx;
}

const saveSnapshotData = async (client, snapshot_id, delegators) => {
    for (const [address, amount] of delegators) {
        const query = `INSERT INTO delegators (id, delegator, amount) VALUES (${snapshot_id}, '${address}', ${amount})`;
        await client.query(query);
    }
}

const main = async () => {

    console.log(process.env.DB_USER)
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT,
    });

    await client.connect();

    try {
        const delegators = await fetchDelegations();
        var idx = await newSnapshot(client);
        await saveSnapshotData(client, idx, delegators);
    } catch (err) {
        console.log(err)
    }

    await client.end();

}

main().then(() => {
    console.log("ok")
    process.exit(0);
}).catch((err) => {
    console.log(err)
    process.exit(1);
});
