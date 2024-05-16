const axios = require('axios');
const { Client } = require('pg');
require('dotenv').config();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const estimateTotal = async () => {
    const url = 'https://terra-classic-lcd.publicnode.com/cosmos/tx/v1beta1/txs?events=execute._contract_address%3D%27terra13w6cruzc0xkdhpmrnspr5j282x3wyx0m4f6kjnr65tpq63usn8eqp5emy4%27&events=wasm.action%3D%27swap%27';
    var promises = []
    for (i=0; i<10; i++) {
        promises.push(axios.get(url));
    }
    try {
        var responses = await Promise.all(promises);
        /*const num =  responses.reduce((prev, curr, idx, all) => {
                return prev + Number(curr.data.total)
            }, 0
        );*/
        console.log(responses.map(response => Number(response.data.total)));
        const maxMinusTen = Math.max(...responses.map(response => Number(response.data.total))) - 10;
        return maxMinusTen;
    } catch (error) {
        return 0;
    }
}

const fetchTxHashes = async (page = 0, inital_total = 0) => {
    try {
        const url = `https://terra-classic-lcd.publicnode.com/cosmos/tx/v1beta1/txs?events=execute._contract_address%3D'terra13w6cruzc0xkdhpmrnspr5j282x3wyx0m4f6kjnr65tpq63usn8eqp5emy4'&events=wasm.action%3D'swap'&page=${page}`;
        const response = await axios.get(url);
        console.log('Fetched Total:', response.data.total);
        if (response.data.total < inital_total) {
            return {data:[], total:-1};
        }

        const txHashes = response.data.tx_responses.map(tx => tx.txhash);
        return {data: txHashes, total: response.data.total};
    } catch (error) {
        return {data:[], total:0};
    }
};

const saveHashesInDB = async (client, hashes) => {
    const uniqueTxHashes = Array.from(new Set(hashes));
    for (const txHash of uniqueTxHashes) {
        // first key is the txhash, second key tells if hash is scraped
        await client.query('INSERT INTO swap_hashes (txhash, scraped) VALUES ($1, $2) ON CONFLICT DO NOTHING', [txHash, false]);
    }
}

async function main() {

    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT,
    });

    try {
        await client.connect();
        await client.query('CREATE TABLE IF NOT EXISTS swap_hashes (txhash VARCHAR PRIMARY KEY, scraped BOOLEAN)');
    } catch (error) {
        console.error('Error connecting to DB:', error);
        return;
    }

    var estimate = await estimateTotal();
    var page = 20;
    var estimate_pages = Math.ceil(estimate/100)
    var hashes = [];
    
    while (true) {
        console.log('Estimate:', estimate);
        console.log('Page:', page);
        var hashes = await fetchTxHashes(page, estimate);
        console.log('Total:', hashes.total);
        while (hashes.total < 0) {
            hashes = await fetchTxHashes(page, estimate);
        }
        if (hashes.total === 0) {
            if (page < estimate_pages) {
		    continue
	    }
            break;
        }
        await saveHashesInDB(client, hashes.data);
        page += 1;
        //estimate = hashes.total;
    }

    await client.end();

}

main().then(() => {
    console.log('Done');
    sleep(10000);
}).catch(console.error);
