var express = require('express')
const cors = require('cors')
const request = require('request');
const { exec } = require('child_process')
var config = require('./config.sample');

const fs = require('fs')
if (fs.existsSync('./config.js')) {
	//Load custom config file
	config = require('./config');
}

var Sonos = require('sonos')
var sonosDiscover = null
var sonos = null

var netatmo = require('netatmo')
var netatmoapi = null
if (config.netatmo.client_id) {
	netatmoapi = new netatmo(config.netatmo);
}

var yahooFinance = require('yahoo-finance');
var NewsAPI = require('newsapi')
var newsapi = null
if (config.newsapi.key) {
	newsapi = new NewsAPI(config.newsapi.key)
}

const ical = require('node-ical');
const moment = require('moment-timezone')

var app = express()
const server = app.listen(config.web.socket, function () {
	console.log('Server listening on port ' + config.web.socket + '.')
})

// Discover sonos device IPs
Sonos.DeviceDiscovery().once('DeviceAvailable', (device) => {
	sonosDiscover = new Sonos.Sonos(device.host)
	sonosDiscover.getAllGroups().then(groups => {
		groups.forEach(group => {
			if (group.Name.substring(0, config.sonos.group.length) == config.sonos.group) {
				sonos = new Sonos.Sonos(group.host)
				sonos.groupCount = group.ZoneGroupMember.length
				sonos.setSpotifyRegion(config.sonos.region)

				sonos.on('CurrentTrack', track => {
					// console.log('Sonos Track changed to %s by %s', track)
					sonos.currentTrack().then((track) => {
						io.emit('SONOS_TRACK', track)
					})
				})

				sonos.on('PlayState', state => {
					// console.log('Sonos state changed to %s.', state)
					io.emit('SONOS_STATE', state)
				})
				sonos.on('Volume', volume => {
					io.emit('SONOS_VOLUME', volume)
				})

			}
		})
	}).catch(err => {
		console.warn('Error loading topology %s', err)
	})
});

const Tibber = require('tibber-api')
const tibberQuery = new Tibber.TibberQuery(config.tibber1);
const tibberQuery2 = new Tibber.TibberQuery(config.tibber2);

// Discover Tibber devices
tibberQuery2.query("fragment SLFragment on SettingLayoutItem {type,title,description,valueText,imgUrl,isUpdated,isEnabled,settingKey,settingKeyForIsHidden}{me{home(id:\"" + config.tibber1.homeId + "\"){powerup{items{type,pairableDevice{deviceType,isPaired,isPairable,settingsLayout{...SLFragment,childItems{...SLFragment}},pairedDevices{deviceId}}}}}}}").then(res => {
	if (res.me && res.me.home && res.me.home.powerup && res.me.home.powerup.items) {
		for (const item of res.me.home.powerup.items) {
			if (item.pairableDevice && item.pairableDevice.isPaired) {
				if (item.pairableDevice.deviceType.includes('heat pump') && item.pairableDevice.pairedDevices.length > 0) {
					config.tibber2.thermostat = item.pairableDevice.deviceType + '#' + item.pairableDevice.pairedDevices[0].deviceId + '#90227'
				}
				if (item.pairableDevice.deviceType.includes('inverter device') && item.pairableDevice.pairedDevices.length > 0) {
					config.tibber2.production = item.pairableDevice.pairedDevices[0].deviceId
					config.tibber2.inverter = item.pairableDevice.pairedDevices[0].deviceId
				}
				if (item.pairableDevice.deviceType.includes('tibber pulse') && item.pairableDevice.pairedDevices.length > 0) {
					config.tibber2.pulse = item.pairableDevice.pairedDevices[0].deviceId
					if (config.tibber2.pulse) {
						initTibberFeed()
					}
				}
			}
		}
	}
})

// Initiate Tibber Feed
var initTibberFeed = function () {
	if (config.tibber1.active) {
		const tibberFeed = new Tibber.TibberFeed(config.tibber1);
		tibberFeed.on('connected', () => {
			console.log('Connected to Tibber');
		});
		tibberFeed.on('connection_ack', () => {
			// console.log('Connection acknowledged!');
		});
		tibberFeed.on('disconnected', () => {
			console.log('Disconnected from Tibber!');
			setTimeout(initTibberFeed, 30000);
		});
		tibberFeed.on('data', data => {
			io.emit('TIBBER_FEED', data)
		});
		tibberFeed.connect();
	}
};

// Initiate internal websocket
const io = require('socket.io')(server);
io.set('origins', ['http://homeboard.local:8080', 'http://localhost:8080']);
io.on('connection', function (socket) {
	// console.log(socket.id)
	if (sonos) {
		sonos.currentTrack().then((track) => {
			io.emit('SONOS_TRACK', track)
		})
		sonos.getCurrentState().then((state) => {
			io.emit('SONOS_STATE', state)
		})
		if (sonos.groupCount > 2) {
			sonos.getGroupVolume().then((volume) => {
				io.emit('SONOS_VOLUME', volume)
			})
		}
		else {
			sonos.getVolume().then((volume) => {
				io.emit('SONOS_VOLUME', volume)
			})
		}
	}
	socket.on('quotes', function (symbols) {
		yahooFinance.quote({
			symbols: symbols,
			modules: ['price']
		}, function (err, quotes) {
			io.emit('QUOTES', quotes)
		});
	})
	socket.on('news', function () {
		if (newsapi) {
			newsapi.v2.topHeadlines(config.newsapi.headlines).then(response => {
				let articles = response.articles.filter(function (el) {
					let keeparticle = true;
					config.newsapi.exclude.forEach(function (word) {
						if (el.title.toLowerCase().indexOf(word) > -1) {
							keeparticle = false;
							return;
						}
					});
					return keeparticle;
				})
				io.emit('NEWS', articles)
			});
		}
	})
	socket.on('config', function () {
		console.log('Send config')
		if (config.netatmo.forecast.device_id) {
			getWeatherToken(function () {
				io.emit('CONFIG', config)
			})
		}
		else {
			io.emit('CONFIG', config)
		}
	})

	socket.on('weather', function () {
		if (netatmoapi) {
			netatmoapi.getStationsData(config.netatmo.options, function (err, devices) {

			})
		}
	})
	socket.on('restart', function () {
		console.log('Restart display manager')
		// exec('sudo systemctl restart display-manager', (error, stdout, stderr) => {
		exec('pm2 restart server', (error, stdout, stderr) => {
			if (error) {
				console.log(`error: ${error.message}`)
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`)
			}
			console.log(`stdout: ${stdout}`)
		})
	})
	socket.on('reboot', function () {
		console.log('Rebooting device')
		require('reboot').reboot();
	})
	socket.on('sleep', function () {
		console.log('Sleep screen')
		// exec('/usr/bin/tvservice -p', (error, stdout, stderr) => {
		exec('export DISPLAY=:0; sleep 1; xset -display :0.0 s activate; /usr/bin/tvservice -p', (error, stdout, stderr) => {
			if (error) {
				console.log(`error: ${error.message}`)
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`)
			}
			console.log(`stdout: ${stdout}`)
		})
	})
	socket.on('wakeup', function () {
		console.log('Wakeup screen')
		exec('export DISPLAY=:0; xset -display :0.0 s off; xset -display :0.0 dpms force on; xset -display :0.0 -dpms', (error, stdout, stderr) => {
			if (error) {
				console.log(`error: ${error.message}`)
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`)
			}
		})
	})
	socket.on('playpause', function (uri) {
		sonos.togglePlayback().then(result => {
			console.log('Started playing %j', result)
		}).catch(err => { console.log('Error occurred %s', err) })
	})
	socket.on('playnext', function (uri) {
		sonos.next().then(result => {
			console.log('Started next %j', result)
		}).catch(err => { console.log('Error occurred %s', err) })
	})
	socket.on('playshuffle', function () {
		console.log('Set playmode shuffle')
		sonos.setPlayMode('SHUFFLE').then(success => {
			console.log('Changed playmode success')
		}).catch(err => { console.log('Error occurred %s', err) })
	})
	socket.on('volumedown', function () {
		if (sonos.groupCount > 2) {
			sonos.adjustGroupVolume(-1)
		}
		else {
			sonos.adjustVolume(-1)
		}
	})
	socket.on('volumeup', function () {
		if (sonos.groupCount > 2) {
			sonos.adjustGroupVolume(1)
		}
		else {
			sonos.adjustVolume(1)
		}
	})
	socket.on('gettrack', function () {
		sonos.currentTrack().then((track) => {
			io.emit('SONOS_TRACK', track)
		})
	})
	socket.on('playURI', function (uri) {
		console.log('Play sonos uri ', uri)
		sonos.selectQueue()
		sonos.flush()
		sonos.setPlayMode('SHUFFLE')
		sonos.play(uri).then(success => {
			// console.log('Playing uri')
		}).catch(err => { console.log('Error occurred %j', err) })
	})
	socket.on('playRadio', function (station) {
		console.log('Play sonos radio ', station)
		sonos.playTuneinRadio(station[0], station[1]).then(success => {
			// console.log('Playing radio')
		}).catch(err => { console.log('Error occurred %j', err) })
	})
	socket.on('setLights', function (mode) {
		console.log('Set lights ', mode)
		setLights(mode)
	})
	socket.on('calendar', function () {
		var calevents = [];
		if (config.calendar.shared.url) {
			ical.async.fromURL(config.calendar.shared.url).then((parsedCal) => {
				const events = Object.values(parsedCal).filter(el => el.type === config.calendar.shared.type)
				for (const event of events) {
					const { start, summary } = event
					const startDate = moment(start).utc().toDate()
					const diff = moment(startDate).diff(new Date(), 'days')
					if (diff >= 0 && diff < config.calendar.shared.days) {
						calevents.push(event);
					}
				}
				//Fetch holiday calendar
				ical.async.fromURL(config.calendar.holiday.url).then((parsedCal) => {
					const events = Object.values(parsedCal).filter(el => el.type === config.calendar.holiday.type)
					for (const event of events) {
						const { start, summary } = event
						const startDate = moment(start).utc().toDate()
						const diff = moment(startDate).diff(new Date(), 'days')
						if ('val' in event.summary) {
							event.summary = event.summary.val;
						}
						if (diff >= 0 && diff < config.calendar.holiday.days) {
							calevents.push(event);
						}
					}

					calevents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
					calevents = calevents.slice(0, 7);
					console.log('Calendar update');
					io.emit('CALENDAR', calevents);

				})
			})
		}
		else if (config.calendar.holiday.url) {
			//Fetch holiday calendar
			ical.async.fromURL(config.calendar.holiday.url).then((parsedCal) => {
				const events = Object.values(parsedCal).filter(el => el.type === config.calendar.holiday.type)
				for (const event of events) {
					const { start, summary } = event
					const startDate = moment(start).utc().toDate()
					const diff = moment(startDate).diff(new Date(), 'days')
					console.log(diff, startDate)
					if ('val' in event.summary) {
						event.summary = event.summary.val;
					}
					if (diff >= 0 && diff < config.calendar.holiday.days) {
						calevents.push(event);
					}
				}

				calevents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
				calevents = calevents.slice(0, 7);
				io.emit('CALENDAR', calevents);
			})
		}
	})

	socket.on('tibber', function (mode) {
		if (tibberQuery) {
			const query = "query {viewer { homes {      currentSubscription{        id validFrom validTo status priceInfo{ current{ total energy tax startsAt currency level } today { total startsAt } tomorrow { total startsAt }}}}} }";
			tibberQuery.query(query).then(res => {
				if (res.viewer && res.viewer.homes) {
					io.emit('TIBBER', res.viewer.homes[0]);
				}
			})
			// const feedQuery = "subscription{ liveMeasurement(homeId:\"" + config.tibber1.homeId + "\"){	\ntimestamp	\npower	\naccumulatedConsumption	\naccumulatedCost	\ncurrency	\nminPower	\naveragePower	\nmaxPower	\n }";
			// tibberQuery.query(feedQuery).then(res => {
			// 	console.log(res);
			// });
		}
	})
	socket.on('tibber2', function (mode) {
		if (tibberQuery2) {
			let query = "{me {home(id:\"" + config.tibber1.homeId + "\") {    ";
			if (config.tibber2.thermostat) {
				query += "thermostat(id:\"" + config.tibber2.thermostat + "\") { state{ comfortTemperature } temperatureSensor { measurement { value } } }    ";
			}
			if (config.tibber2.inverter) {
				query += "inverter(id:\"" + config.tibber2.inverter + "\") {bubble {  value  percent} }  inverterProduction (id:\"" + config.tibber2.production + "\"){keyFigures {  valueText  unitText  description} }    ";
			}
			query += "}}}";
			tibberQuery2.query(query).then(res => {
				if (res.me) {
					io.emit('TIBBER2', res.me.home);
				}
			})
		}
	})
	socket.on('tibber3', function (mode) {
		if (tibberQuery2) {
			const query = "{me {home(id:\"" + config.tibber1.homeId + "\") {    electricVehicles {battery {percent} isAlive imgUrl batteryText}    }}}";
			tibberQuery2.query(query).then(res => {
				if (res.me) {
					io.emit('TIBBER3', res.me.home);
				}
			})
		}
	})
	socket.on('setthermo', function (temp) {
		console.log('Set thermostat ', temp)
		tibberQuery2.query("mutation { me { home(id: \"" + config.tibber1.homeId + "\") { thermostat(id: \"" + config.tibber2.thermostat + "\") { setState(comfortTemperature: " + temp + ") }    }  } }").then(res => {
			// console.log(JSON.stringify(res, null, 2))
		})
	})

})

// Get weather token
var getWeatherToken = function (callback) {
	//Fetch Netatmo public access token
	return request('https://weathermap.netatmo.com/', (err, res, body) => {
		if (err) { return console.log(err) }
		if (body.indexOf('accessToken') > -1) {
			let tokenplace = body.indexOf('accessToken')
			let tokenstart = body.indexOf('"', tokenplace) + 1
			let tokenend = body.indexOf('"', tokenstart + 1)
			let access_token = body.substring(tokenstart, tokenend)
			console.log('Got weather token', access_token)
			config.netatmo.forecast.bearer = access_token
			callback()
		}
		else {
			console.log('Could not get weather tokenstart')
			callback()
		}
	})
};

// Get weather station data
var getStationsData = function (err, devices) {
	devices.forEach(function (device) {
		console.log('Weather update')
		io.emit('WEATHER', parseStationData(device))
	})
};
var parseStationData = function (device) {
	var json_data = {};
	if (device.dashboard_data && device.dashboard_data.hasOwnProperty("time_utc")) {
		if (device.module_name == 'Indoor' && device.dashboard_data) {
			json_data.indoor = device.dashboard_data
		}
		device.modules.forEach(function (module) {
			if (module.module_name == 'Outdoor' && module.dashboard_data) {
				json_data.outdoor = module.dashboard_data
			}
			if (module.module_name == 'Wind' && module.dashboard_data) {
				json_data.outdoor.wind_deg = module.dashboard_data.GustAngle
				json_data.outdoor.wind_speed = module.dashboard_data.GustStrength
			}
		})
		return json_data
	}
	else {
		console.log("Invalid weather data")
		console.log(device)
	}
}
if (netatmoapi) {
	netatmoapi.on('get-stationsdata', getStationsData)
}

// Motion sensor to enable screen
var gpio = require('rpi-gpio')
var last_motion_state = false
var motion_value = 0
gpio.on('change', function (channel, value) {
	// Test by turning down screensaver to few sec
	// export DISPLAY=:0
	// xset s 2
	//console.log('Channel ' + channel + ' value is now ' + value +' total ' + motion_value);
	if (Math.abs(motion_value) > 10) {
		exec('export DISPLAY=:0 && xdotool mousemove 1 2')
		motion_value = 0
	}
	if (value == true) {
		motion_value++
	}
	else {
		motion_value--
	}
	last_motion_state = value
});
gpio.setup(11, gpio.DIR_IN, gpio.EDGE_BOTH)

// var setLights = function(mode){
// 	if (mode == 'tv'){

// 	}
// 	if (mode == 'dinner'){

// 	}
// 	if (mode == 'evening'){

// 	}
// 	if (mode == 'off'){

// 	}
// 	light_api.groups.getGroupByName('Kitchen').then(group => {
// 		const groupState = new GroupLightState()
// 			.on()
// 			.brightness(70)
// 			.saturation(80)
// 			;
// 		authenticatedApi.groups.setGroupState(group[0].id, groupState);
// 	})
// }

// const v3 = require('node-hue-api').v3
// 	, discovery = v3.discovery
// 	, hueApi = v3.api
// 	, GroupLightState = v3.lightStates.GroupLightState
// 	;
// var light_api;
// discovery.nupnpSearch().then(discoveryResults => {
// 	if (discoveryResults.length === 0) {
// 		console.error('Failed to resolve any Hue Bridges');
// 		const ipAddress = null;
// 	} else {
// 		// Ignoring that you could have more than one Hue Bridge on a network as this is unlikely in 99.9% of users situations
// 		const ipAddress = discoveryResults[0].ipaddress;

// 		hueApi.createLocal(ipAddress).connect(config.hue.username).then(authenticatedApi => {
// 			light_api = authenticatedApi;
// 			// light_api.groups.getGroupByName('Kitchen').then(group => {
// 			// 	const groupState = new GroupLightState()
// 			// 		.on()
// 			// 		.brightness(70)
// 			// 		.saturation(80)
// 			// 		;
// 			// 	authenticatedApi.groups.setGroupState(group[0].id, groupState);
// 			// })

// 			// authenticatedApi.groups.getAll().then(scenes => {
// 			// 	console.log(scenes)

// 			// })

// 		})
// 	}
// }).catch(err => { console.log('Hue error occurred %j', err) })


let webpath = 'www';
if (fs.existsSync(webpath)) {
	// Check if running already
	request('http://localhost:' + config.web.port, (err, res) => {
		if (err && err.code == 'ECONNREFUSED') {
			var connect = require('connect');
			var serveStatic = require('serve-static');
			connect().use(serveStatic(webpath)).listen(config.web.port, () => {
				console.log('Server running on port ' + config.web.port + '...');
			});
		}
		else if (res.statusCode == 200) {
			console.log('Server already running on port ' + config.web.port + '...');
		}
	})
}

