const express = require('express');
const { Client } = require('pg');
const https = require('https');
require('dotenv').config();
const fs = require('fs');

const app = express();
const port = process.env.SERVE_PORT || 3000;

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

// Middleware to handle errors
function errorHandler(err, req, res, next) {
    console.error('Internal server error:', err);
    res.status(500).json({ error: 'Internal server error' });
}

// Route to handle API request
async function getLuncVolumeTimeSeries(page) {
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
async function getLuncVolumeTotal() {
    try {
        const query = `SELECT SUM(CASE WHEN offer_denom = 'uluna' THEN offer_amount ELSE output END) FROM swap_txs`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

async function getHolders() {
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

async function getStakerSnapshots() {
    try {
        const query = `SELECT * FROM snapshots_delegators ORDER BY created DESC`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

async function getStakerSnapshotIds() {
    try {
        const query = `SELECT id FROM snapshots_delegators ORDER BY created DESC`;
        const result = await client.query(query);
        return result.rows.map(row => row.id);
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

async function getStakersById(id) {
    try {
        const query = `SELECT * FROM delegators WHERE id=${id} ORDER BY amount DESC`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

async function getStakersFormatted() {
    try {
        snapshots = await getStakerSnapshots();
        if (snapshots.length == 0) {
            return [];
        }
        latestSnapshotId = snapshots[0].id;
        console.log(latestSnapshotId);
        const result = await getStakersById(latestSnapshotId);
        console.log(result);
        const scaledResult = result.map(row => {row.amount = row.amount / 1000000; row.amount = row.amount.toLocaleString('en-US'); return row});
        //console.log(scaledResult);
        const mappedScaled = scaledResult.map(row => {return {address: row.delegator, amount: row.amount}});
        return mappedScaled;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

async function getStakersByIdAirdropFiltered(id, min_delegation, max_delegation) {
    try {
        const query = `SELECT delegator, (CASE WHEN amount > ${max_delegation} THEN ${max_delegation} ELSE amount END) FROM delegators WHERE id=${id} AND amount >= ${min_delegation} ORDER BY amount DESC`;
        const result = await client.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

async function getStakersAirdropEligibility(min_delegation, max_delegation) {
    try {
        const ids = await getStakerSnapshotIds();
        //var mapped = new Map();
        const mapped = await Promise.all(ids.map(async (id) => {
            const result = await getStakersByIdAirdropFiltered(id, min_delegation, max_delegation);
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

        const averageMap = new Map();
        for (const [key, value] of mergedMap) {
            const average = Math.floor(value / ids.length);
            averageMap.set(key, average);
        }

        const formattedData = Array.from(averageMap, ([delegator, amount]) => ({ delegator, amount }));

        const scaledResult = formattedData.map(row => {row.amount = row.amount / 1000000; row.amount = row.amount.toLocaleString('en-US'); return row});
        console.log(scaledResult);
        
        return scaledResult;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }   
}


app.get('/api/swaps/lunc_vol/series/:page', async (req, res, next) => {
    try {
        console.log('Request received');
        const page = parseInt(req.params.page);
        if (isNaN(page) || page < 0) {
            return res.json([]);
        }
        const result = await getLuncVolumeTimeSeries(page);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get('/api/swaps/lunc_vol/total', async (req, res, next) => {
    try {
        console.log('Request received');
        const result = await getLuncVolumeTotal();
        res.json(result[0]);
    } catch (error) {
        next(error);
    }
});

app.get('/api/holders/list', async (req, res, next) => {
    try {
        console.log('Request received');
        const result = await getHolders();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get('/api/stakers/list', async (req, res, next) => {
    try {
        console.log('Request received');
        const result = await getStakersFormatted();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get('/api/airdrop/eligibility_data', async (req, res, next) => {
    try {
        console.log('Request received');
        const result = await getStakersAirdropEligibility(1000000000000, 1000000000000000);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Register error handling middleware
app.use(errorHandler);

// Read SSL certificates
var server;

try {
    const privateKey = fs.readFileSync(process.env.SSL_KEY, 'utf8');
    const certificate = fs.readFileSync(process.env.SSL_CERT, 'utf8');
    const credentials = {
        key: privateKey,
        cert: certificate
    };
    server = https.createServer(credentials, app);
} catch (error) {
    console.error('Error reading SSL certificates.');
    console.error('Falling back to HTTP server');
    server = app;
}

// Start the server
async function startServer() {
    await connectDatabase();
    server.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

startServer().catch(err => {
    console.error('Error starting the server:', err);
});
