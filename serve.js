const express = require('express');
const { Client } = require('pg');
const https = require('https');
require('dotenv').config();
const fs = require('fs');
const db = require('./db');
const common = require('./common');
const contracts = require('./vesting_contracts');

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

async function getStakersFormatted() {
    try {
        snapshots = await db.getStakerSnapshots(client);
        if (snapshots.length == 0) {
            return [];
        }
        latestSnapshotId = snapshots[0].id;
        console.log(latestSnapshotId);
        const result = await db.getStakersById(client, latestSnapshotId);
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

async function getStakersAirdropEligibility(client, min_delegation, max_delegation) {
    try {
        const averageMap = await db.getStakersAverageMap(
            client,
            min_delegation,
            max_delegation,
            common.AirdropBlacklist
        );

        const formattedData = Array.from(averageMap, ([delegator, amount]) => ({ delegator, amount }));

        const totalAmount = Array.from(averageMap.values()).reduce((acc, amount) => acc + amount, 0);
        const formattedDataWithPercentage = formattedData.map(row => {
            const percentage = ((row.amount / totalAmount) * 100).toFixed(2);
            return { ...row, percentage };
        });

        const scaledResult = formattedDataWithPercentage.map(row => {
            row.amount = row.amount / 1000000;
            row.amount = row.amount.toLocaleString('en-US');
            return row
        });
        console.log(scaledResult);
        
        return scaledResult;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }   
}

async function getStakersAirdropDistribution(client, min_delegation, max_delegation) {
    try {
        const averageMap = await db.getStakersAverageMap(
            client,
            min_delegation,
            max_delegation,
            common.AirdropBlacklist
        );

        const formattedData = Array.from(averageMap, ([delegator, amount]) => ({ delegator, amount }));

        const totalAmount = Array.from(averageMap.values()).reduce((acc, amount) => acc + amount, 0);
        const formattedDataWithPercentage = formattedData.map(row => {
            const percentage = ((row.amount / totalAmount) * 100).toFixed(2);
            return { ...row, percentage };
        });

        const scaledResult = formattedDataWithPercentage.map(row => {
            row.amount = row.amount / 1000000;
            row.amount = row.amount.toLocaleString('en-US');
            return row
        });
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
        const result = await db.getHolders(client);
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
        const result = await getStakersAirdropEligibility(client, 1000000000000, 1000000000000000);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get('/api/airdrop/distribution_data', async (req, res, next) => {
    try {
        console.log('Request received');
        const totalVest = await contracts.getTotalVest();
        const weights = await contracts.getWeights();
        const mapped = weights.map(w => {return {address: w.address, lockdrop_amount: Number(w.weight*totalVest)/1000000}});
        const sorted = mapped.sort((a, b) => b.lockdrop_amount - a.lockdrop_amount);
        const formatted = sorted.map(row => {row.lockdrop_amount = row.lockdrop_amount.toLocaleString('en-US'); return row});
        res.json(formatted);
    } catch (error) {
        next(error);
    }

});

app.get('/api/price/latest', async (req, res, next) => {
    try {
        console.log('Request received');
        const result = await db.getLatestPrice(client);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.get('/api/supply/total', async (req, res, next) => {
    try {
        console.log('Request received');
        const result = await db.getSupply(client, db.TOTAL_SUPPLY_ID);
        res.json(Number(result));
    } catch (error) {
        next(error);
    }
});

app.get('/api/supply/circulating', async (req, res, next) => {
    try {
        console.log('Request received');
        const result = await db.getSupply(client, db.CIRC_SUPPLY_ID);
        res.json(Number(result));
    } catch (error) {
        next(error);
    }
});

// Register error handling middleware
app.use(errorHandler);

// Read SSL certificates
var server;
const LISTEN = process.env.SERVE_HOST

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
    server.listen(port, LISTEN, () => {
        console.log(`Server running on port ${port}`);
    });
}

startServer().catch(err => {
    console.error('Error starting the server:', err);
});
