const express = require('express');
const { Client } = require('pg');
require('dotenv').config();

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

// Register error handling middleware
app.use(errorHandler);

// Start the server
async function startServer() {
    await connectDatabase();
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

startServer().catch(err => {
    console.error('Error starting the server:', err);
});
