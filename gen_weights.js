const { Client } = require('pg');
require('dotenv').config();


// PostgreSQL client setup
const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

// Connect to the PostgreSQL database
async function connectDatabase() {
    try {
        await client.connect();
        console.log('Connected to the database');
    } catch (error) {
        console.error('Error connecting to the database:', error);
    }
}

async function getIds() {
    try {
        const query = `SELECT id FROM snapshots_delegators ORDER BY created DESC`;
        const result = await client.query(query);
        return result.rows.map(row => row.id);
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

async function byIdFiltered(id, min_delegation, max_delegation) {
    try {
        const query = `SELECT delegator, (CASE WHEN amount > ${max_delegation} THEN ${max_delegation} ELSE amount END) FROM delegators WHERE id=${id} AND amount >= ${min_delegation} ORDER BY amount DESC`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

async function getStakersAirdropEligibilityCSV(min_delegation, max_delegation) {
    try {
        const ids = await getIds();
        
        // get (airdrop filtered) stakers for each snapshot
        const mapped = await Promise.all(ids.map(async (id) => {
            const result = await byIdFiltered(id, min_delegation, max_delegation);
            return result.reduce((acc, row) => {
                const amount = Number(row.amount);
                if (acc.has(row.delegator)) {
                    acc.set(row.delegator, Number(acc.get(row.delegator)) + amount);
                } else {
                    acc.set(row.delegator, amount);
                }
                return acc;
            }, new Map());
        }));

        // merge the maps - sum up the amounts for each delegator
        const mergedMap = mapped.reduce((acc, map) => {
            for (const [key, value] of map) {
                if (acc.has(key)) {
                    acc.set(key, Number(acc.get(key)) + value);
                } else {
                    acc.set(key, value);
                }
            }
            return acc;
        }, new Map());

        // calculate the average staking amount for each delegator
        const averageMap = new Map();
        for (const [key, value] of mergedMap) {
            const average = Math.floor(value / ids.length);
            averageMap.set(key, average);
        }

        // blacklist wallets
        for (const wallet of airdropBlacklist) {
            averageMap.delete(wallet);
        }

        const averageSum = Array.from(averageMap.values()).reduce((acc, amount) => acc + amount, 0);

        var objects = []
        var weights_sum = 0;
        averageMap.forEach((value, key) => {
            const weight = value/averageSum;
            weights_sum += weight;
            objects.push([key, weight.toFixed(10)]);
        });
        
        return objects;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }   
}

function validateAndCorrectWeightsToSumToOne(objects) {
    var sum = 0;
    objects.forEach((obj) => {
        sum += Number(obj[1]);
    });
    console.log("uncorrected sum", sum);
    objects[0][1] = (Number(objects[0][1]) + (1 - sum)).toFixed(10);

    sum = 0;
    objects.forEach((obj) => {
        sum += Number(obj[1]);
    });
    console.log("corrected sum", sum);
    return objects;
}

// for the juris lockdrop
/*connectDatabase().then(() => {
    getStakersAirdropEligibilityCSV(1000000000000, 1000000000000000).then((res) => {
        //console.log(res);
        const corrected = validateAndCorrectWeightsToSumToOne(res);
        const instantiateMsg = {
            managed_denom: { cw20: "terra1vhgq25vwuhdhn9xjll0rhl2s67jzw78a4g2t78y5kz89q9lsdskq2pxcj2" },
            weights: corrected,
            admin: "terra14qk5u5yqhz9w3snz5mdl0ve5awgtjrpfy0rsjh",
        }
        console.log(JSON.stringify(instantiateMsg));
        client.end();
    });
}).catch((error) => {
    console.error('Error connecting to the database:', error);
});*/

// for the shirini lockdrop
connectDatabase().then(() => {
    getStakersAirdropEligibilityCSV(1000000000000, 100000000000000).then((res) => {
        //console.log(res);
        const corrected = validateAndCorrectWeightsToSumToOne(res);
        const instantiateMsg = {
            managed_denom: { cw20: "terra1vhgq25vwuhdhn9xjll0rhl2s67jzw78a4g2t78y5kz89q9lsdskq2pxcj2" },
            weights: corrected,
            admin: "terra14qk5u5yqhz9w3snz5mdl0ve5awgtjrpfy0rsjh",
        }
        console.log(JSON.stringify(instantiateMsg));
        client.end();
    });
}).catch((error) => {
    console.error('Error connecting to the database:', error);
});
