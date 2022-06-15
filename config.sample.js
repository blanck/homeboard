var config = {};

config.netatmo = {};
config.newsapi = {};
config.calendar = {};
config.hue = {};
config.sonos = {};
config.tibber1 = {};
config.tibber2 = {};
config.cam = {};
config.background = {};
config.quotes = [];
config.time = {};
config.web = {};
config.weather = {};
config.playlist = {};
config.location = {
	"lat": 56.4277887,
	"lng": 12.842306
};
// Set language for weather and dates - ex. 'en', 'sv'
config.language = "en";
config.autosleep = "22-07"; //hh-hh

config.quotes = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^OMX", "SI=F", "GC=F"];
config.time = {
	"localzone": "Europe/Stockholm",
	"remotezone": "America/Los_Angeles"
};
config.cam = {
	// Add live webcamera URL
	// "url": "http://83.140.123.181/ImageHarvester/Images/copyright!-bastad_1_live.jpg"
};
config.background = {
	// Add static background URL
	"url": "https://hotelskansen.se/app/uploads/sites/6/hotel-skansen-bastad-20160121-vinter-0016.jpg"
};
config.web = {
	"port": 8080,
	"socket": 3000
};
config.weather = {
	"openweathermap": {
		// Register for API key at https://home.openweathermap.org/api_keys
		"key": "83032a45ab76e8ddbd826905caf45b31",
		"url": "http://api.openweathermap.org/data/2.5/weather?lang=" + config.language + "&lat=" + config.location.lat + "&lon=" + config.location.lng + "&APPID=",
	},
	"met_no": {
		"url": "https://api.met.no/weatherapi/locationforecast/2.0/?lat=" + config.location.lat + "&lon=" + config.location.lng
	},
	"popup": {
		"url": "https://regnradar.se/?lat=" + config.location.lat + "&lng=" + config.location.lng
	}
};

config.netatmo = {
	"client_id": "",
	"client_secret": "",
	"username": "",
	"password": "",
	"options": {
		"device_id": "70:ee:50:28:b7:a2",
	},
	"forecast": {
		// Find with browser inspector at https://weathermap.netatmo.com/
		"device_id": "70:ee:50:28:b7:a2", // Example: 70:aa:bb:33:00:ee
		"module_id": "05:00:00:06:b1:30", // Example: 02:03:00:33:00:ee
		"bearer": "52d42bfc1777599b298b456c|567441d6b0f7282c9250a7cfe4075761", // Example: 52xxxxxxxxxxxxxxx|4ayyyyyyyyyyyy
		"locale": "en-US"
	}
};
config.newsapi = {
	"key": "da0fc2a9d664472396eff8c1f149b9e7", // Register for free api key at https://newsapi.org/register
	"headlines": {
		language: "en",
		sources: "bbc-news,bloomberg,techcrunch,business-insider,cnbc",
		pageSize: 30
	},
	"exclude": [
		"corona", "virus", "covid-19", "covid", "pandemic", "ventilator", "trump"
	]
};
config.sonos = {
	"group": "", // Enter sonos group name, ex. Kitchen
	"region": "2311" //EU = 2311
};
config.calendar = {
	"shared": {
		// Published calendar url, find out how to publish: https://support.apple.com/guide/calendar/publish-or-unpublish-calendars-on-mac-icl1017/mac
		// Example: https://p42-caldav.icloud.com/published/2/AAAAAAAAA....
		"url": "",
		"type": "VEVENT",
		"days": 30
	},
	"holiday": {
		// Holiday calendar or secondary shared calendar
		"url": "https://www.officeholidays.com/ics-local-name/sweden",
		"type": "VEVENT",
		"days": 90
	}
};
config.hue = {
	"username": "",
	"client_key": ""
};
config.tibber1 = {
	// Endpoint configuration. Get token from https://developer.tibber.com/settings/accesstoken
	"active": true, // Enable live feed
	"apiEndpoint": {
		"apiKey": "", // Enter gql token
		"feedUrl": "wss://api.tibber.com/v1-beta/gql/subscriptions",
		"queryUrl": "https://api.tibber.com/v1-beta/gql",
	},
	// Query configuration.
	"homeId": "",
	"timestamp": true,
	"power": true,
	"accumulatedConsumption": true,
	"maxPower": true,
	"powerProduction": true,
};
config.tibber2 = {
	// Endpoint configuration. Get token by making POST request:
	// curl 'https://app.tibber.com/v1/login.credentials' -H 'content-type: application/json' --data-binary '{"email":"mail@gmail.com","password":"XXXX"}'
	"apiEndpoint": {
		"apiKey": "", //Enter v1 gql token
		"feedUrl": "wss://app.tibber.com/v4/gql/subscriptions",
		"queryUrl": "https://app.tibber.com/v4/gql",
	},
};

config.playlist = {
	// Get Spotify URI by sharing a playlist and copy the playlist ID from the url
	// Get Sonos radio channel id by searching on https://tunein.com/search/ and copy the last ID
	// Example: https://tunein.com/radio/Awfully-Awesome-Eighties-s240931/ = s240931
	"breakfast": {
		"title": "Breakfast",
		"icon": "music_note_2",
		"type": "spotify",
		"list": [
			["spotify:user:spotify:playlist:3x6xRt9FnSbfPbgiO6incZ", "French Cafe"],
			["spotify:user:spotify:playlist:1Rj92hyXm3WjpOJI8XgYtF", "French Jazz"],
			["spotify:user:spotify:playlist:37i9dQZF1DXb5Mq0JeBbIw", "Soft Morning"]
		]
	},
	"dinner": {
		"title": "Dinner",
		"icon": "music_note_2",
		"type": "spotify",
		"list": [
			["spotify:user:spotify:playlist:1aQ5dknXwy7SMmxo6d4C8B", "Italian dinner"],
			["spotify:user:spotify:playlist:37i9dQZF1DX4xuWVBs4FgJ", "Dinner with friends"]
		]
	},
	"kids": {
		"title": "Kids",
		"icon": "music_note_2",
		"type": "spotify",
		"list": [
			["spotify:user:spotify:playlist:3Z5feJGvNWzbWM5m5mwOmy", "Frozen2 Soundtrack"],
			["spotify:user:spotify:playlist:1KiVRMzrO5YDNcRuyjGz80", "Moana Soundtrack"],
		]
	},
	"acoustic": {
		"title": "Acoustic",
		"icon": "music_note_2",
		"type": "spotify",
		"list": [
			["spotify:user:spotify:playlist:37i9dQZF1DWXmlLSKkfdAk", "Acoustic Covers"],
		]
	},
	"radio": {
		"title": "Radio",
		"icon": "antenna_radiowaves_left_right",
		"type": "radio",
		"list": [
			["s41848", "Cat Country 98.7"],
			["s240931", "Awesome Eighties"],
		]
	},
	"cooking": {
		"title": "Cooking",
		"icon": "music_note_2",
		"type": "spotify",
		"list": [
			["spotify:user:spotify:playlist:37i9dQZF1DXdsy92d7BLpC", "weekend hangouts"],
			["spotify:user:spotify:playlist:37i9dQZF1DWTvNyxOwkztu", "Chillout lounge"],
			["spotify:user:spotify:playlist:3EfJJ8yvEae5fxPooM6WzF", "ZARA Store"],
			["spotify:user:spotify:playlist:2j5DKnz62m6W7OBppCznvT", "Blanck Poolparty"]
		]
	}
};

module.exports = config;