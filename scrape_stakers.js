const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

const validator = 'terravaloper1ufc3rfz62ez73n5e9t8kc8nkdp8sfpxtyqkq7l'

const fetchDelegations = async (txhash) => {
    var page = 1;
    const url = `https://terra-classic-lcd.publicnode.com/cosmos/staking/v1beta1/validators/${validator}/delegations`;
    var all_delegations = [];
    var next = undefined;

    try {
        const response = await axios.get(url);
        var delegations = response.data.delegation_responses;
        all_delegations.push(...delegations);
        all_delegations = all_delegations.flat();
        next = response.data.pagination.next_key;
        console.log(next)
    } catch (err) {
        console.log('Could not Fetch delegators')
        console.log(err)
        return undefined;
    }

    while (next) {
        try {
            const response = await axios.get(url + `?pagination.key=${next}`);
            delegations = response.data.delegation_responses;
            all_delegations.push(...delegations);
            all_delegations = all_delegations.flat();
            next = response.data.pagination.next_key;
            console.log(next)
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
