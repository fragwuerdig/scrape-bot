const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

const getUnscrapedHashesFromDB = async (client, limit = 10) => {
    const result = await client.query(`SELECT * FROM swap_hashes WHERE scraped = false LIMIT ${limit}`);
    return result.rows.map(row => row.txhash);
}

const markHashesAsScraped = async (client, hashes) => {
    await client.query(`UPDATE swap_hashes SET scraped = true WHERE txhash = ANY($1)`, [hashes]);
}

const fetchTxHash = async (txhash) => {
    const url = `https://terra-classic-lcd.publicnode.com/cosmos/tx/v1beta1/txs/${txhash}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (err) {
        err.response.data.code === 5 ? console.log('Tx not found:', txhash) : console.log('Error fetching tx:', txhash);
        return undefined;
    }
}

const getEventByType = (events, type) => {
    return events.filter(event => event.type === type);
}

const getAttributeValueByKey = (attributes, key) => {
    return attributes.find(attr => attr.key === key).value;
}

const saveSwapInDB = async (client, swap_data) => {
    const query = `INSERT INTO swap_txs (txhash, height, offer_amount, offer_denom, output, time, trader) VALUES ('${swap_data.txhash}', ${swap_data.height}, ${swap_data.offer_amount}, '${swap_data.offer_asset}', ${swap_data.output}, '${swap_data.time}', '${swap_data.trader}')`;
    await client.query(query);
}

const main = async () => {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT,
    });

    await client.connect();

    try {
        const hashes = await getUnscrapedHashesFromDB(client);
        for (const hash of hashes) {
            const data = await fetchTxHash(hash);
            if (data === undefined) {
                continue;
            }
            const wasm_events = getEventByType(data.tx_response.logs[0].events, 'wasm');
            const ask_asset = getAttributeValueByKey(wasm_events[0].attributes, 'ask_asset');
            const timeString = data.tx_response.timestamp;
            //const unixTimestamp = new Date(timeString).getTime() / 1000;
            
            const swap_data = {
                txhash: hash,
                height: data.tx_response.height,
                offer_asset: (ask_asset === 'uluna') ? 'urakoff' : 'uluna',
                output: getAttributeValueByKey(wasm_events[0].attributes, 'return_amount'),
                offer_amount: getAttributeValueByKey(wasm_events[0].attributes, 'offer_amount'),
                time: timeString,
                trader: data.tx.body.messages[0].sender
            }
            await saveSwapInDB(client, swap_data);
            await markHashesAsScraped(client, [hash]);
        }
    } catch (error) {
        console.error('Error:', error);
        return;
    }

}

main().then(() => {
    console.log("ok")
    process.exit(0);
}).catch((err) => {
    console.log(err)
    process.exit(1);
});