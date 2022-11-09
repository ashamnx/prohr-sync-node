import fetch from "node-fetch";
import {ZKLib} from "./libs/node-zklib/zklib.js";
import {COMMANDS} from "./libs/node-zklib/constants.js";

import * as dotenv from 'dotenv';

dotenv.config();

const api = process.env.API_URL;
const api_key = process.env.API_KEY;

const environment = {api, api_key};

const headers = {
    'Content-Type': 'application/json', 'Authorization': environment.api_key
}

let readerList = [];
const fetchReaderListMinutes = 5;

const main = async () => {
    if (!environment.api || !environment.api_key) {
        console.error('API or API_KEY not set');
        return;
    }

    await loadReaders();

    setInterval(async () => {
        await loadReaders();
    }, 1000 * 60 * fetchReaderListMinutes);

    for (const {id, IP, name, commands} of readerList) {
        console.log({id, IP, name, commands});

        let zkInstance = new ZKLib(IP, 4370, 10000, 4000);
        try {
            // Create socket to machine
            await zkInstance.createSocket();

            // Get general info like logCapacity, user counts, logs count
            // It's really useful to check the status of device
            console.log('device', await zkInstance.getInfo());

        } catch (e) {
            console.log(e)
            if (e.code === 'EADDRINUSE') {
            }
            continue;
        }

        // Get users in machine
        // const users = await zkInstance.getUsers();
        // console.log(`users in ${IP}`, users);


        // Get all logs in the machine
        // Currently, there is no filter to take data, it just takes all !!
        const logs = await zkInstance.getAttendances();
        const posted = await postRecords(logs.data);
        if (!posted) {
            continue;
        }

        if (commands.restart) {
            await zkInstance.executeCmd(COMMANDS.CMD_RESTART, '');
        }

        // const attendances = await zkInstance.getAttendances((percent, total) => {
        // this callbacks take params is the percent of data downloaded and total data need to download
        // })

        // YOu can also read realtime log by getRealTimelogs function
        listenToReader(zkInstance, {IP, name}).then(() => {});

        // console.log('check users', users)

        // delete the data in machine
        // You should do this when there are too many data in the machine, this issue can slow down machine
        if (commands.clear_attendance) {
            await zkInstance.clearAttendanceLog();
        }


        // Get the device time
        // console.log(zkInstance);
        // const getTime = await zkInstance.timer;
        // console.log(getTime.toString());

        // Disconnect the machine ( don't do this when you need realtime update :)))
        // await zkInstance.disconnect();
    }

}

const loadReaders = async () => {
    try {
        console.log('Fetching readers');
        const res = await fetch(environment.api + '/api/readers/active', {method: 'GET', headers});
        const data = await res.json();
        readerList = data.data;
        console.log(`Fetched readers: ${readerList.length}`);
    } catch (e) {
        console.error(e, 'Error fetching readers: ' + (new Date()).toString());
    }
}

const postRecords = async (records) => {
    try {
        console.log('Posting records to server: ' + records.length);
        const res = await fetch(environment.api + '/api/sync_attendance', {
            method: 'POST', headers, body: JSON.stringify(records)
        });
        await res.json();
        return true;
    } catch (e) {
        console.error(e, 'Error posting records to server: ' + (new Date()).toString());
        return false;
    }
}

const listenToReader = async (zkInstance, {IP, name}) => {
    console.log(`Listening for realtime events on ${IP}: (${name})`);
    try {
        await zkInstance.getRealTimeLogs((data) => {
            postRecords([data]);
            console.log(data);
        });
    } catch (e) {
        console.error(e, 'Error listening to reader: ' + (new Date()).toString());
    }
}

main();
