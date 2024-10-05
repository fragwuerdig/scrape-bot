const common = require('./common');

const getStakersSnaphotIds = async function (client) {
    try {
        const query = `SELECT id FROM snapshots_delegators ORDER BY created DESC`;
        const result = await client.query(query);
        return result.rows.map(row => row.id);
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

const  getStakersById = async function (client, id) {
    try {
        const query = `SELECT * FROM delegators WHERE id=${id} ORDER BY amount DESC`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

const getLatestPrice = async function (client) {
    try {
        const query = `SELECT price FROM price_points ORDER BY time DESC LIMIT 1`;
        const result = await client.query(query);
        return result.rows[0].price;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

// Route to handle API request
const getLuncVolumeTimeSeries = async function (client, page) {
    try {
        const query = `SELECT CASE WHEN offer_denom = 'uluna' THEN offer_amount ELSE output END AS volume, time FROM swap_txs ORDER BY time ASC LIMIT 100 OFFSET $1;`;
        const result = await client.query(query, [page]);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

// Route to handle API request
const getLuncVolumeTotal = async function (client) {
    try {
        const query = `SELECT SUM(CASE WHEN offer_denom = 'uluna' THEN offer_amount ELSE output END) FROM swap_txs`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

const getHolders = async function (client) {
    try {
        const query = `SELECT * FROM holders WHERE amount > 0 ORDER BY amount DESC`;
        const result = await client.query(query);
        const scaledResult = result.rows.map(row => {row.amount = row.amount / 1000000; row.amount = row.amount.toLocaleString('en-US'); return row});
        return scaledResult;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

const getStakerSnapshots = async function (client) {
    try {
        const query = `SELECT * FROM snapshots_delegators ORDER BY created DESC`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

const getStakersByIdAirdropFiltered = async function(client, id, min_delegation, max_delegation) {
    try {
        const query = `SELECT delegator, (CASE WHEN amount > ${max_delegation} THEN ${max_delegation} ELSE amount END) FROM delegators WHERE id=${id} AND amount >= ${min_delegation} ORDER BY amount DESC`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

const getStakersAverageMap = async function (client, min_delegation, max_delegation, blacklist) {
    try {
        const ids = await getStakersSnaphotIds(client);
        
        // get (airdrop filtered) stakers for each snapshot
        const mapped = await Promise.all(ids.map(async (id) => {
            const result = await getStakersByIdAirdropFiltered(client, id, min_delegation, max_delegation);
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
        for (const wallet of blacklist) {
            averageMap.delete(wallet);
        }

        return averageMap;
    
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }   
}

exports.getStakersSnaphotIds = getStakersSnaphotIds;
exports.getStakersById = getStakersById;
exports.getLatestPrice = getLatestPrice;
exports.getLuncVolumeTimeSeries = getLuncVolumeTimeSeries;
exports.getLuncVolumeTotal = getLuncVolumeTotal;
exports.getHolders = getHolders;
exports.getStakerSnapshots = getStakerSnapshots;
exports.getStakersByIdAirdropFiltered = getStakersByIdAirdropFiltered;
exports.getStakersAverageMap = getStakersAverageMap;