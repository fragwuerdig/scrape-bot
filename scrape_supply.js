const dotenv = require('dotenv')
const db = require('./db')
const { Client } = require('pg');

dotenv.config()

const TOKEN_ADDRESS_TERRA = process.env.TOKEN_ADDRESS_TERRA
const exception_list = [
    // Liq. Reserve
    'terra1xnu72mn60yzcyr0fl8avgjy5wepfw85c0knfeh',
    'terra1wfxrk3ergtze8jk8jmxhzjw2u5slmpqaaxd0f5',
    
    // DMZ
    'terra1pfefmmls2w67njucd2qgvv4qefcutyl95g986pd69caxdyzp7acsfp0fv8',
    'terra1cjjy4yzzp6sdv6uq27u6l82gslpdkw4l3zk785674mh8gk9dn5qqvr4nr0',
    'terra1rtwut7skslgcnfptj2xdjwpddv3a9cw6nhdwe7aej5nx5qkqmd6saqnsrv',
    
    // LOCKDROP
    'terra14783nqrx4mjqfnymyqp88dsjf5c6axlt2m75wwt2supwkc0jxr0qyrhqtl',
    'terra1w89kclh6qd4ftyll4k0x4cyd23lzd9krsntds4y0z2x67kymtf3qj9fgrl',
    'terra1lejvcrgmhcuedemdetv6qrru7yu8qgwn6e070fq6q4kpda838kpsghwl2u',
    
    // Team Multisig and vesting dao
    'terra13rc00u4lnysvzz9kcl02q3xrejsxkfkjxqvd20',
    'terra1rzwuz9cc2j057xpgmf500t78uhttwyfgsspuyqulhs4yqx53rnlqejrtqa',

    // Team Vestin
    'terra1qscthwdtd7axaax05m423g70cntlrlwx7la44wxmaynr72jl8ssqjpf5v9',
    'terra1jt70skckl3a3zl98l7na4zqhuyyaerx97rdt9gy2u6eadxc2ke8s2lffsl',
    'terra1jw5e3hk3k2qz9985r2c3fd0ac5uuz6j98xp9ealnu9qt3dx2wtuqc202fn',
    'terra13jhdcxd3v7n6fnc4gjj692jsa4jfnh83aly87vj4kyn5c8gp02esgelln5',
    'terra1pljarz83hu9rfdvg88ft8dr76rwmkr5r0avv30ra3p6pgdepfutqrw90dr',
    'terra1p989tvvezfl766tgc8m83qk4wjxyelr7hhum4d8w93yjej4vmx8sgl46q7',
    'terra104vm43leyxhe67eq8cmatk0xnhg3usv8z3czz5rjummhgk4ky2fs6tp8yk',
    'terra1as5mdt6v6xfugcrv9qd3jm5uqjlmkkemlat66m2ewsepgsnnrggq9hcd9m',
    'terra12xq35pp48mwp7qep2tdlnt2jg8pxmsll0vtnygay7tgh0djdk34sw6qhdl',
    
    // LLL Treasury
    'terra1q6hmppyadwee5h8jeyymljug4d9ywj2kgpgmtm',

    // STAKING
    'terra1rta0rnaxz9ww6hnrj9347vdn66gkgxcmcwgpm2jj6qulv8adc52s95qa5y',
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
        await db.updateSupply(client, supply.toFixed(2), db.TOTAL_SUPPLY_ID)

        const balancesProm = await exception_list.map(async (wallet) => {
            return ask_balance_terra(wallet)
        })
        const balances = await Promise.all(balancesProm)
        const balancesScaled = balances.map(balance => balance/1000000)
        balancesScaled.forEach((balance, index) => {
            console.log(balance)
            supply = supply - balance
        })
        const circ_supply = supply.toFixed(2)
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
