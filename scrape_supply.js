const dotenv = require('dotenv')
const db = require('./db')
const { Client } = require('pg');

dotenv.config()

const TOKEN_ADDRESS_TERRA = process.env.TOKEN_ADDRESS_TERRA
const exception_list = [
    // Liq. Reserve
    'terra1xnu72mn60yzcyr0fl8avgjy5wepfw85c0knfeh',
    
    // DMZ
    'terra1pfefmmls2w67njucd2qgvv4qefcutyl95g986pd69caxdyzp7acsfp0fv8',
    'terra1cjjy4yzzp6sdv6uq27u6l82gslpdkw4l3zk785674mh8gk9dn5qqvr4nr0',
    'terra1rtwut7skslgcnfptj2xdjwpddv3a9cw6nhdwe7aej5nx5qkqmd6saqnsrv',
    
    // LOCKDROP
    'terra14783nqrx4mjqfnymyqp88dsjf5c6axlt2m75wwt2supwkc0jxr0qyrhqtl',
    'terra1w89kclh6qd4ftyll4k0x4cyd23lzd9krsntds4y0z2x67kymtf3qj9fgrl',
    'terra1lejvcrgmhcuedemdetv6qrru7yu8qgwn6e070fq6q4kpda838kpsghwl2u',
    
    // Team Multisig
    'terra13rc00u4lnysvzz9kcl02q3xrejsxkfkjxqvd20',
    
    // LLL Treasury
    'terra1q6hmppyadwee5h8jeyymljug4d9ywj2kgpgmtm',
]

const ask_total_supply_terra = async (wallet) => {
    const smart_query = {
        token_info: {}
    }
    const encoded_query = Buffer.from(JSON.stringify(smart_query)).toString('base64');
    const query = `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${TOKEN_ADDRESS_TERRA}/smart/${encoded_query}`
    const response = await fetch(query)
    const response_data = await response.json()
    return Number(response_data.data.total_supply)
}

const ask_balance_terra = async (wallet) => {
    const smart_query = {
        balance: {
            address: wallet
        }
    }
    const encoded_query = Buffer.from(JSON.stringify(smart_query)).toString('base64');
    const query = `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${TOKEN_ADDRESS_TERRA}/smart/${encoded_query}`
    const response = await fetch(query)
    const response_data = await response.json()
    return Number(response_data.data.balance)
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
        var supply = (await ask_total_supply_terra())/1000000
        await db.updateSupply(client, supply.toLocaleString('en-US'), db.TOTAL_SUPPLY_ID)

        const balancesProm = await exception_list.map(async (wallet) => {
            return ask_balance_terra(wallet)
        })
        const balances = await Promise.all(balancesProm)
        const balancesScaled = balances.map(balance => balance/1000000)
        balancesScaled.forEach((balance, index) => {
            console.log(balance)
            supply = supply - balance
        })
        const circ_supply = supply.toLocaleString('en-US')
        await db.updateSupply(client, circ_supply, db.CIRC_SUPPLY_ID)

    } catch (error) {
        console.error('Error updating circulating supply:', error)
        return
    }
}

main().then(() => {
    console.log('done')
    process.exit(0)
}).catch((error) => {
    console.error(error)
});