'use strict';

const fs = require('fs');
const Blink = require('node-blink-security');

let authJson = fs.readFileSync('./auth.json');
let auth = JSON.parse(authJson);
let groupsJson = fs.readFileSync('./groups.json');
let groups = JSON.parse(groupsJson);

let hottest;
let coldest;
let groupTemp = {};

var blink = new Blink(auth.user, auth.password);
var systems = [ 'Home 1', 'Home 2' ];

systems.forEach(function(system) {
    blink.setupSystem(system)
      .then(() => {
        blink.getCameras()
          .then(() => {

            if (system == 'Home 1') return;

            console.log(['SYSTEM', 'ID', 'Camera', 'Temp'].join(','))
            Object.keys(blink.cameras).forEach(function(key) {
                var camera = blink.cameras[key];
                console.log([system, key, camera.name, camera.temperature].join(','));
            });

            Object.keys(groups).forEach(function(group) {
                let log = { sum: 0, min: 120, max: 0, average: 0, temps: [] };
                groups[group].forEach(function(cameraID) {
                    let camera = blink.cameras[cameraID];
                    let temperature =  camera.temperature;
                    log.temps.push(temperature);
                    if (temperature < log.min) {
                        log.min = temperature;
                    }
                    if (temperature > log.max) {
                        log.max = temperature;
                    }
                    log.sum += temperature;
                });
                log.average = log.sum/log.temps.length;
                delete log.sum;
                groupTemp[group] = log;
            });
            console.log(groupTemp);
          });
      }, (error) => {
        console.log(error);
      });
});

