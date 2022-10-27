/*
    Get ready for a WILD ride - last lines are where things pick up after the worker gets the message. 
*/

const { parentPort } = require('worker_threads')
const delay = ms => new Promise(res => setTimeout(res, ms));

// I wanted something simple for this project, I don't plan on actually using SQL on something this small atm
const { QuickDB } = require("quick.db");

const projectedsDb = new QuickDB({ filePath: './projs_json.sqlite' })
const rapDb = new QuickDB({ filePath: './raplogs_json.sqlite' })

// -- {}

const avg_before = (beforeInt, afterInt, array) => {
    var fixed_data = []
    
    for(var i = afterInt; i >=0; i--) if (i<=beforeInt) break; else fixed_data.push(array[i]);

    if (fixed_data.length<=0) return 0;

    var total = 0; for (val of fixed_data) total+=val;
    return total/fixed_data.length
};

const getQuantile = (array, quantile) => {
    let index = quantile / 100.0 * (array.length - 1);

    if (index % 1 === 0) {
        return array[index]
    }else {
        let lowerIndex = Math.floor(index);
        let remainder = index - lowerIndex;
        
        return array[lowerIndex] + remainder * (array[lowerIndex + 1] - array[lowerIndex])
    }
};

const filterLPPS = (dataSet) => {
    let values = dataSet.slice().sort((a, b) => a - b); // copy array fast and sort

    let q1 = getQuantile(values, 25);
    let q3 = getQuantile(values, 75);

    let iqr, minValue;
    iqr = q3 - q1;
    minValue = q1 - iqr * 1.5;

    return values.filter((x) => (x >= minValue))
};

const checkItem = async (id, itemData, previouslyMarked) => {
    /*
        itemData = [item_name, acronym, rap, value, default_value, demand, trend, projected, hyped, rare]
    */

    // Array of old projecteds
    const rapData = await rapDb.get(`db.${id}`) || {LU: 0, unmark_rap: 0, data: []};

    let dataChanged;

    if (Date.now() - rapData.LU >= 86400000){
        if (rapData.data.length>=30) rapData.data.pop();

        rapData.data.unshift(itemData[2]);

        rapData.LU = Date.now();

        dataChanged=true
    };

    if (previouslyMarked == true){
        itemData[7]=1; 
        itemData[8]=(rapData.unmark_rap=="rolimons")?0:rapData.unmark_rap;

        if (rapData.unmark_rap=="rolimons" && itemData[7]==-1){
            rapData.unmark_rap=0; itemData[7]=-1;  
            await projectedsDb.pull("db", id)
        };

        // if it's at/below the unmark rap or valued it'll unmark it
        if (rapData.unmark_rap>=itemData[2] || itemData[3]!=-1){
            rapData.unmark_rap=0; itemData[7]=-1;  
            await projectedsDb.pull("db", id)
        };
    };

    // Checks if an item is valued or not even having a value 
    if (itemData[3]!=-1 || itemData[4]<=0) return [itemData];

    // Checks if the item is new; you COULD remove this but, new item's are volatile so it's hard for the bot to mark them proj based off rap data
    if (rapData.data.length<5){

        // They usually stablize after halving their value (like my crypto portfolio)
        rapData.unmark_rap=itemData[4]*0.4; 
        
        itemData[7]=1; itemData[8]=rapData.unmark_rap; 

        await projectedsDb.push("db", id);

        return [
            itemData, 
            new Promise(async (resolve) => {
                await rapDb.set(`db.${id}`, rapData);
                resolve()
            })
        ]
    };

    itemData[7]=-1;

    // Gets rid of most false positives
    let fixedData = filterLPPS(rapData.data);

    for(let i = fixedData.length-1; i >=0; i--) {
        let originalRap = fixedData[i]; let newRap = fixedData[i-1] || itemData[2];

        if ((newRap-originalRap)/originalRap >= 0.5){
            // See I wrote this a month ago and I completely forgot why I did this, forgive me
            let avgRapBeforeProj = avg_before(i, ((fixedData.length-1)-i < 30)?(fixedData.length-1)-i:i+30, fixedData) || 0; 

            // checks if the projection has already died down
            let skip; 
            for(var x = x-1; x >=0; x--) {if (avgRapBeforeProj>=fixedData[x]) {skip=x; break}};

            while (fixedData.length-1>skip) fixedData.pop();

            i=skip;
            if (avgRapBeforeProj>=itemData[2]) break; if (skip!=null) continue;

            if (i+1>=30 && itemData[7]==-1) continue; // Checks if the projection is 30 days or older and is not marked on Rolimons (ik this is a lazy way for checking if projs are old)

            rapData.unmark_rap=avgRapBeforeProj; itemData[7]=1;
            itemData[8]=rapData.unmark_rap; 
            await projectedsDb.push('db', `${id}`); 

            dataChanged=true;
            
            break
        };
    };

    if (dataChanged==true){
        return [
            itemData, 
            new Promise(async (resolve) => {
                await rapDb.set(`db.${id}`, rapData); 
                resolve()
            })
        ]
    }else return [
        itemData, 
        new Promise(async (resolve) => {
            await rapDb.set(`db.${id}`, rapData); 
            resolve()
        })
    ]
};

// 

parentPort.on('message', async (values) => {
    values=JSON.parse(values);
    try{
        const oldProjs = await projectedsDb.get('db');
        
        let promisesQueue = [];
        let cycleFinished;

        new Promise(async (resolve) => {
            while (cycleFinished==null){
                await delay(100);

                if (promisesQueue.length<=0) continue;

                await Promise.all(promisesQueue);

                promisesQueue.splice(0, promisesQueue.length)
            };
            resolve()
        });

        for (itemId in values) {
            let itemResult = await checkItem(itemId, values[itemId], oldProjs.includes(itemId));

            values[itemId] = itemResult[0];
            if (itemResult[1]!=null) promisesQueue.push(itemResult[1]);

            while (promisesQueue.length>10) {await delay(100)}
        };

        cycleFinished=true;

        // waiting for the last of the queue to finish
        while (promisesQueue.length>0) {await delay(100)};

        parentPort.postMessage(JSON.stringify(values))
    }catch(err){console.log(err)}
});