/*
    I'll add comments on some things but, not everything will be documented.

    Roblox Limited projected detector for private snipebot, feel free to use it \\^^//
*/

const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
const express = require("express");

const fs = require("fs");
const path = require('path');
const { Worker } = require("worker_threads");
const delay = ms => new Promise(res => setTimeout(res, ms));

const app = express(); app.use(express.static(path.join(__dirname, 'public')));

//--- 
//const rateLimiter = require("./subFiles/ratelimit.js");
//---

app.get("/values", async (res) => {
    try{
        res.send(JSON.stringify(fixedValues))
    }catch(err){
        console.log(err);
        res.sendStatus(500)
    };
});

//--{}

const getRolimonsValues = async () => {
    while (true){
        try{
            let req = await fetch("https://www.rolimons.com/itemapi/itemdetails")
                .catch((err) => console.log(err)) || {};
            if (req.status!=200) {await delay(5000); continue};

            let values = (await req.json()).items
            if (values!=null) return values;
        }catch(err){
            console.log(err)
        };
    };
};

//--{}

fs.readFile("./config.json", {encoding: 'utf-8'}, async (err, res) => {
    if (err) throw err;

    try{
        global.serverConfig = JSON.parse(res);
    }catch(err){console.log(`Your config file is either invalid or not in the same folder as index.js\n${err}`)};

    // I'm only starting a worker once so that I don't have to keep reopening them (it's more efficent that way)
    let pageWorker = new Worker("./subFiles/projWorker.js");

    let response;
    pageWorker.on("message", (message) => {
        response=message
    });
    pageWorker.once("error", async (err) => {console.log(err)});
    
    app.listen(9000);

    while (true){
        let recentValues = await getRolimonsValues(); 
        pageWorker.postMessage(JSON.stringify(recentValues));

        // waiting for the response
        while (response==null) await delay(500); 

        response==null;

        try{
            global.fixedValues=JSON.parse(response);
            console.log(fixedValues);
            await delay(60000)
        }catch(err){
            console.log(err)
        }
    }
})