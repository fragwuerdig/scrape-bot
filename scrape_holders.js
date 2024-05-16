const axios = require('axios');
const { Client } = require('pg');
require('dotenv').config();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAccounts() {
    var last = ""
    var resArray = []
    while (true) {
        try {
            const query = (last === "") ? '{"all_accounts": {"limit":30}}' : `{"all_accounts": {"start_after":"${last}","limit":30}}`;
            const queryBase64 = Buffer.from(query).toString('base64');
            const url = `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/terra1vhgq25vwuhdhn9xjll0rhl2s67jzw78a4g2t78y5kz89q9lsdskq2pxcj2/smart/${queryBase64}`
            res = await axios.get(url)
            const tmpArray = res.data.data.accounts;
            if (tmpArray.length == 0) {
                break;
            }
            resArray = resArray.concat(tmpArray);
            last = tmpArray[tmpArray.length - 1];
        } catch (error) {
            console.error('Error:', error);
            break;
        }
    }
    return resArray;
}

async function getAccountBalances(holders) {
    var promiseArray = []
    for (const holder of holders) {
        const query = `{"balance":{"address":"${holder}"}}`
        const queryBase64 = Buffer.from(query).toString('base64');
        const url = `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/terra1vhgq25vwuhdhn9xjll0rhl2s67jzw78a4g2t78y5kz89q9lsdskq2pxcj2/smart/${queryBase64}`
        const promise = axios.get(url)
        promiseArray.push({address: holder, balance: promise});
        sleep(200);
    }
    const resolvedPromises = await Promise.all(promiseArray.map(async (promiseObj) => {
        const response = await promiseObj.balance;
        return { address: promiseObj.address, balance: Number(response.data.data.balance)};
    }));
    return resolvedPromises;
}

async function insertHoldersIntoDB(client, holders) {
    for (const holder of holders) {
        await client.query('INSERT INTO holders (address, amount) VALUES ($1, $2) ON CONFLICT (address) DO UPDATE SET amount = $2', [holder.address, holder.balance]);
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
    } catch (error) {
        console.error('Error connecting to DB:', error);
        return;
    }

    const accounts = await getAccounts();
    const balances = await getAccountBalances(accounts);

    try {
        await insertHoldersIntoDB(client, balances);
    } catch (error) {
        console.error('Error:', error);
    }

}

main().then(() => {
    console.log('Done');
    process.exit(0);
}).catch((error) => {
    console.error('Error:', error);
    process.exit(1);    
});
