import fetch from "node-fetch";
import {ZKLib} from "./libs/node-zklib/zklib.js";
import {COMMANDS} from "./libs/node-zklib/constants.js";

const environment = {
    'api': 'https://hr2.port.mv',
    'api_key': "1234567890",
}

const headers = {
    'Content-Type': 'application/json',
    'Authorization': environment.api_key
}

let readerList = [];
const fetchReaderListMinutes = 5;

const main = async () => {
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
        }

        // Get users in machine
        // const users = await zkInstance.getUsers();
        // console.log(`users in ${IP}`, users);


        // Get all logs in the machine
        // Currently, there is no filter to take data, it just takes all !!
        const logs = await zkInstance.getAttendances();
        await postRecords(logs.data);

        if (commands.restart) {
            await zkInstance.executeCmd(COMMANDS.CMD_RESTART, '');
        }

        // const attendances = await zkInstance.getAttendances((percent, total) => {
        // this callbacks take params is the percent of data downloaded and total data need to download
        // })

        // YOu can also read realtime log by getRealTimelogs function

        // console.log('check users', users)
        //
        console.log("Listening for realtime events");
        await zkInstance.getRealTimeLogs((data) => {
            postRecords(data);
            console.log(data);
        });


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
    console.log('Fetching readers');
    const res = await fetch(environment.api + '/api/readers/active', {method: 'GET', headers});
    const data = await res.json();
    console.log(data);
    readerList = data.data;
}

const postRecords = async (records) => {
    console.log({records});
    const res = await fetch(environment.api + '/api/sync_attendance', {
        method: 'POST',
        headers,
        body: JSON.stringify(records)
    });
    const data = await res.json();
    console.log(data);
}

main();
