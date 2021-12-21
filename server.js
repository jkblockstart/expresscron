// set up, get all tools we need
const express = require('express')
const app = express()
const path = require('path')
const config = require('config')
const fs = require('fs')
const port = process.env.PORT || 8888
const storeabi = require('./storeabi')
const Web3 = require("web3")
const CHAIN_URL = 'https://mainnet.infura.io/v3/de423f792e82422db36f9dea39f3936b'
const web3 = new Web3(new Web3.providers.HttpProvider(CHAIN_URL))

const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f'
const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const bridgeAddress = '0x151982ebf8fbbb8979167b64b729f5f5c43562db'

app.use(function (req, res, next) {
    next();
});

app.use((req, res, next) => {
    res.removeHeader('X-Powered-By')
    next()
})

app.get('/run/cron', async (req, res) => {
    const daiContract = new web3.eth.Contract(storeabi.abi, daiAddress)

    const usdcContract = new web3.eth.Contract(storeabi.abi, usdcAddress)

    const poolContract = new web3.eth.Contract(storeabi.abi2, bridgeAddress)

    let daiNumDivide = BigInt(10 ** 18)
    let usdcNumDivide = BigInt(10 ** 6)

    let daiValue = await daiContract.methods.balanceOf(bridgeAddress).call()
	let usdcValue = await usdcContract.methods.balanceOf(bridgeAddress).call()

    // 0 is usdc
    let poolDepositUsdc = await poolContract.methods.poolDeposit(0).call()

    // 1 is dai
	let poolDepositDai = await poolContract.methods.poolDeposit(1).call();

    daiValue = BigInt(daiValue)
	let totalDai = BigInt(daiValue) + BigInt(poolDepositDai)
	
	let percentLeftDai = (Number(daiValue * 100n / totalDai) / 100) * 100

    usdcValue = BigInt(usdcValue)
	let totalUsdc = BigInt(usdcValue) + BigInt(poolDepositUsdc)
	
	let percentLeftUsdc = (Number(usdcValue * 100n / totalUsdc) / 100) * 100

    // Whether to add dai or withdraw dai
    let daiMsg = ""
    if(percentLeftDai < 30){
        let p = BigInt(30 - percentLeftDai)
        let daiValueToChange = totalDai * p / 100n
        daiValueToChange = Number(daiValueToChange * 100n / daiNumDivide) / 100
        daiMsg = `Amount to Withdraw: $${daiValueToChange}`
    }else{
        let p = BigInt(percentLeftDai - 30)
        let daiValueToChange = totalDai * p / 100n
        daiValueToChange = Number(daiValueToChange * 100n / daiNumDivide) / 100
        daiMsg = `Amount to Deposit: $${daiValueToChange}`
    }

    // Whether to add usdc or withdraw usdc
    let usdcMsg = ""
    if(percentLeftUsdc < 30){
        let p = BigInt(30 - percentLeftUsdc)
        let usdcValueToChange = totalUsdc * p / 100n
        usdcValueToChange = Number(usdcValueToChange * 100n / usdcNumDivide) / 100
        usdcMsg = `Amount to Withdraw: $${usdcValueToChange}`
    }else{
        let p = BigInt(percentLeftUsdc - 30)
        let usdcValueToChange = totalUsdc * p / 100n
        usdcValueToChange = Number(usdcValueToChange * 100n / usdcNumDivide) / 100
        usdcMsg = `Amount to Deposit: $${usdcValueToChange}`
    }

    const chatId = -477569474
    
    let data = fs.readFileSync('./info.txt', 'utf-8')

    if(data != ""){
        // not first time
        // check data
        let d = data.split('\n')
    
        let fileUsdcValue = d[0]
        let fileDaiValue = d[1]
    
        let txtToWrite = `${usdcValue}\n${daiValue}`
        fs.writeFileSync('./info.txt', txtToWrite)
    
        if(daiValue != fileDaiValue){
          // send message
          daiValue = Number(daiValue * 100n / daiNumDivide) / 100
          totalDai = Number(totalDai * 100n / daiNumDivide) / 100
          let daiTextComp = `DAI Info\n Current Liquidity: $${daiValue}\n Total Bridge Fund: $${totalDai}\n ${daiMsg}`
          console.log(daiTextComp)
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: daiTextComp
          })
        }
    
        if(usdcValue != fileUsdcValue){
          // send message
          usdcValue = Number(usdcValue * 100n / usdcNumDivide) / 100
          totalUsdc = Number(totalUsdc * 100n / usdcNumDivide) / 100
          let usdcTextComp = `USDC Info\n Current Liquidity: $${usdcValue}\n Total Bridge Fund: $${totalUsdc}\n ${usdcMsg}`
          console.log(usdcTextComp)
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: usdcTextComp
          })
        }
    
      }else{
        // first time
        // send to both
        // store both
        // 0 is usdc, 1 is dai
        let txtToWrite = `${usdcValue}\n${daiValue}`
        await fs.writeFileSync('./info.txt', txtToWrite)
    
        daiValue = Number(daiValue * 100n / daiNumDivide) / 100
        totalDai = Number(totalDai * 100n / daiNumDivide) / 100
        let daiTextComp = `DAI Info\n Current Liquidity: $${daiValue}\n Total Bridge Fund: $${totalDai}\n ${daiMsg}`
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: daiTextComp
        })
    
        usdcValue = Number(usdcValue * 100n / usdcNumDivide) / 100
        totalUsdc = Number(totalUsdc * 100n / usdcNumDivide) / 100
        let usdcTextComp = `USDC Info\n Current Liquidity: $${usdcValue}\n Total Bridge Fund: $${totalUsdc}\n ${usdcMsg}`
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: usdcTextComp
        })
    
      }

      return res.send('All done')
})

app.listen(port)
console.log('\x1b[36m%s\x1b[0m', 'Magic happens on port:', port)
module.exports = app