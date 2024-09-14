const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.CMC_API_KEY;

const savePricePoint = async (client, price) => {
    const timestamp = new Date().toISOString();
    const query = `INSERT INTO price_points (price, time) VALUES ($1, $2)`;
    const values = [price, timestamp];
    try {
        await client.query(query, values);
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

const fetchLuncPrice = async () => {
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
    const parameters = {
        'id': '4172',
        'convert': 'USD'
    }
    const headers = {
        'Accepts': 'application/json',
        'X-CMC_PRO_API_KEY': API_KEY
    }
    try {
        const response = await axios.get(url, {headers: headers, params: parameters})
        return Number(response.data.data['4172'].quote.USD.price);
    } catch (err) {
        console.log('Could not Fetch price')
        console.log(err)
        return undefined;
    }
}

const fetchPairPrice = async () => {
    const pair = 'terra13w6cruzc0xkdhpmrnspr5j282x3wyx0m4f6kjnr65tpq63usn8eqp5emy4'
    const query = {
        pool: {}
    }
    const query_data = Buffer.from(JSON.stringify(query)).toString('base64');
    const url = `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${pair}/smart/${query_data}`
    try {
        const response = await axios.get(url)
        const lunc_amt = Number(response.data.data.assets[1].amount);
        const juris_amt = Number(response.data.data.assets[0].amount);
        return lunc_amt/juris_amt;
    } catch (err) {
        console.log('Could not Fetch price')
        console.log(err)
        return undefined;
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
        const lunc_price_in_usd = await fetchLuncPrice();
        const juris_price_in_lunc = await fetchPairPrice();
        const juris_price_in_usd = lunc_price_in_usd*juris_price_in_lunc;
        await savePricePoint(client, juris_price_in_usd);
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