'use strict';

const fs = require('fs');
const Blink = require('node-blink-security');
const chalk = require('chalk');
const commander = require('commander');

let authJson = fs.readFileSync('./auth.json');
let auth = JSON.parse(authJson);
let groupsJson = fs.readFileSync('./groups.json');
let groups = JSON.parse(groupsJson);

var blink1 = new Blink(auth.blink.user, auth.blink.password);
var blink1Promise = blink1.setupSystem('Home 1');

var blink2 = new Blink(auth.blink.user, auth.blink.password);
var blink2Promise = blink2.setupSystem('Home 2');

function snapPictures(blink) {
    return Object.keys(blink.cameras).reduce(function(promise, key) {
        return promise.then(function() {
            let camera = blink.cameras[key];
            return camera.snapPicture().catch(function(error) {
                console.log(error + "\n");
            });
        }, );
    }, Promise.resolve());
}

function reportRawData(blink, system, includeUrls) {
    Object.keys(blink.cameras).forEach(function(key) {
        var camera = blink.cameras[key];
        var data = [system, key, camera.name, camera.temperature, camera.thumbnail, camera.clip];
        if (!includeUrls) {
            data.pop();
            data.pop();
        }
        console.log(data.join(','));
    });
}

function gatherTemperature(blinkMap) {
    let hottest = 0;
    let coldest = 120;
    let groupTemp = {};

    Object.keys(groups).forEach(function(group) {
        let log = { sum: 0, min: 120, max: 0, average: 0, temps: [] };
        groups[group].forEach(function(cameraInfo) {
            let blink = blinkMap[cameraInfo.system];
            if(!blink) {
                console.log(`Can not located ${cameraInfo.system}`);
                return;
            }

            let camera = blink.cameras[cameraInfo.id];
            if(!camera) {
                console.log(`Can not located camera id ${cameraInfo.id} on ${cameraInfo.system}`);
                return;
            }

            let temperature =  camera.temperature;
            log.temps.push(temperature);
            if (temperature < log.min) {
                log.min = temperature;
            }

            if (temperature < coldest) {
                coldest = temperature;
            }

            if (temperature > log.max) {
                log.max = temperature;
            }

            if (temperature > hottest) {
                hottest = temperature;
            }

            log.sum += temperature;
        });
        log.average = log.sum/log.temps.length;
        delete log.sum;
        groupTemp[group] = log;
    });

    return {
        hottest: hottest,
        coldest: coldest,
        groups:  groupTemp,
    };
}

function formatTemps(strings, ...params) {
    let constants = [ ...strings ];
    let variables = [ ...params ];

    let parts = [];
    parts.push(constants.shift());
    while(constants.length) {
        parts.push(formatTemp(variables.shift()));
        parts.push(constants.shift());
    }
    return parts.join('');
}

function formatTemp(value) {
    value = Math.round(value);
    if (value > 90) {
        return chalk.keyword('red')(value);
    } else if (value > 80 && value <= 90) {
        return chalk.keyword('orange')(value);
    } else if (value > 70 && value <= 80) {
        return chalk.keyword('green')(value);
    } else if (value > 70 && value <= 80) {
        return chalk.keyword('liteblue')(value);
    } else {
        return chalk.keyword('blue')(value);
    }
}

function reportResult(result) {
    console.info(formatTemps`
-----------------------------------------------------------------------------------
Hottest: ${result.hottest}
Coldest: ${result.coldest}
-----------------------------------------------------------------------------------
Outside:    ${result.groups.outside.average} (${result.groups.outside.min} to ${result.groups.outside.max})
Inside:     ${result.groups.inside.average} (${result.groups.inside.min} to ${result.groups.inside.max})
Upstairs:   ${result.groups.upstairs.average} (${result.groups.upstairs.min} to ${result.groups.upstairs.max})
Downstairs: ${result.groups.downstairs.average} (${result.groups.downstairs.min} to ${result.groups.downstairs.max})
-----------------------------------------------------------------------------------
Rooms with AC:
 - Master Bedroom: ${result.groups.bedroom.average} (${result.groups.bedroom.min} to ${result.groups.bedroom.max})
 - Computer Room:  ${result.groups.computer.average} (${result.groups.computer.min} to ${result.groups.computer.max})
-----------------------------------------------------------------------------------
`)
}

commander
    .description('Quick report of home temeratures from IOT sensors')
    .version('1.0.0')
    .option('-d, --debug',        'Show debugging output')
    .option('-o, --only-cameras', 'Show only cameras in debug output')
    .option('-v, --verbose',      'Include raw data in the output')
    .option('--no-urls',          'Exclude the urls in the raw output')
    .option('--no-color',         'Disable the color output')
    .option('--snap',             'Take snapshots for all the cameras [broken]')
    .parse(process.argv);

chalk.enabled = commander.color ? true : false;

Promise.all([ blink1Promise, blink2Promise ]).then(function(blinks) {
    blink1.getLinks();
    blink2.getLinks();

    return Promise.all([blink1.getCameras(), blink2.getCameras()]);
})
.then(function(blinks) {
    if (commander.snap) {
        return Promise.all([snapPictures(blink1), snapPictures(blink2)]);
    } else {
        return Promise.resolve();
    }
})
.then(function() {
    if (commander.debug) {
        if(commander.onlyCameras) {
            console.log(blink1.cameras);
            console.log(blink2.cameras);
        } else {
            console.log(blink1);
            console.log(blink2);
        }
    }
})
.then(function() {
    if (commander.verbose) {
        let titles = ['SYSTEM', 'ID', 'Camera', 'Temp', 'Thumbnail', 'Clip'];
        if (!commander.urls) {
            titles.pop();
            titles.pop();
        }
        console.log(titles.join(','))
        reportRawData(blink1, 'Home 1', commander.urls);
        reportRawData(blink2, 'Home 2', commander.urls);
    }

    let result = gatherTemperature({
        'Home 1': blink1,
        'Home 2': blink2,
    });
    reportResult(result);
}).catch(function(error) {
    console.error(error);
});


// https://account.smartthings.com/tokens/new

// const smartthings = require('smartthings-node');
// let st = new smartthings.SmartThings(auth.smartthings.token);
// st.devices.listDevices().then(function(devices) {
//     console.log(devices);
// });
// st.deviceProfiles.listDeviceProfiles().then(function(profiles) {
//     console.log(profiles);
// });


