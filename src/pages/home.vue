<template>
  <f7-page name="home" :class="showBackground ? 'fullbg' : ''">
    <f7-block class="widgets" v-if="!showBackground">
      <f7-row class="top">
        <f7-col class="widget weather" width="35">
          <f7-row>
            <f7-col class="text-align-right">
              <img :src="currentConditionImage" class="image" v-if="currentConditionImage" />
            </f7-col>
            <f7-col class="text-align-left">
              <div v-if="weather && weather.outdoor" class="title">
                {{ weather.outdoor.Temperature }}&deg;
              </div>
            </f7-col>
          </f7-row>
          <f7-row>
            <f7-col>
              <div class="subtitle" v-if="currentCondition">
                {{ formatCondition(currentCondition.description) }}
              </div>
            </f7-col>
          </f7-row>
          <f7-row>
            <f7-col>
              <div class="details" v-if="weather && weather.outdoor" @click="showWeather()">
                <f7-icon f7="arrow_down_to_line"></f7-icon>
                {{ weather.outdoor.min_temp }}&deg; &nbsp;&nbsp;&nbsp;
                <f7-icon f7="arrow_up_to_line"></f7-icon>
                {{ weather.outdoor.max_temp }}&deg; &nbsp;&nbsp;&nbsp;
                <span
                  v-if="
                    (forecast && forecast.current_windgust) ||
                      (weather.outdoor && weather.outdoor.wind_speed)
                  "
                >
                  <f7-icon f7="hand_draw"></f7-icon>
                  {{ formatFeelsLike(weather, forecast) }}&deg; &nbsp;&nbsp;&nbsp;
                </span>
                <f7-icon f7="drop"></f7-icon>
                {{ weather.outdoor.Humidity }} %
                <div>
                  <span
                    v-if="
                      weather &&
                        weather.outdoor &&
                        weather.outdoor.wind_speed &&
                        weather.outdoor.wind_deg
                    "
                  >
                    <f7-icon
                      f7="location_north"
                      :style="formatWindDirection(weather.outdoor.wind_deg)"
                    ></f7-icon>
                    {{ formatWind(weather.outdoor.wind_speed) }} m/s &nbsp;&nbsp;&nbsp;
                  </span>
                  <span v-else-if="forecast && forecast.current_windgust">
                    <f7-icon
                      f7="location_north"
                      :style="
                        formatWindDirection(
                          (forecast.forecastDays && forecast.forecastDays[0].winddirection) || 0
                        )
                      "
                    ></f7-icon>
                    {{ formatWind(forecast.current_windgust) }} m/s &nbsp;&nbsp;&nbsp;
                  </span>
                  <f7-icon f7="speedometer"></f7-icon>
                  {{ formatPressure(weather.indoor.Pressure) }}
                  <f7-icon
                    :f7="formatPressureIcon(weather.indoor.pressure_trend)"
                    v-if="weather.indoor.pressure_trend"
                  ></f7-icon
                  >&nbsp;&nbsp;&nbsp;
                  <span v-if="weather.indoor.CO2">
                    <f7-icon f7="sparkles"></f7-icon>
                    {{ formatCO2(weather.indoor.CO2) }}
                    <small>ppm</small>&nbsp;&nbsp;&nbsp;
                  </span>
                </div>
              </div>
              <small v-if="weather && weather.outdoor"
                >{{ translate('updated') }} {{ formatFromNow(weather.outdoor.time_utc) }}</small
              >
            </f7-col>
          </f7-row>
        </f7-col>
        <f7-col class="widget time" width="30">
          <f7-row>
            <f7-col>
              <div class="title">{{ currentTime }}</div>
            </f7-col>
          </f7-row>
          <f7-row>
            <f7-col>
              <div class="subtitle">{{ currentDay }}</div>
            </f7-col>
          </f7-row>
          <f7-row>
            <f7-col>
              <div class="secondtitle">{{ remoteAbbr }} {{ remoteTime }}</div>
            </f7-col>
          </f7-row>
        </f7-col>
        <f7-col class="widget forecast" width="35">
          <f7-row class="justify-content-space-around" v-if="forecast">
            <f7-col v-for="(day, index) in forecast.forecastDays" :key="index">
              <div class="day">{{ day.day_locale }}</div>
              <div class="temp">{{ day.min_temp }} &ndash; {{ day.max_temp }}&deg;</div>
              <div class="forecast-icon">
                <img
                  :src="
                    `https://weathermap.netatmo.com/images/weathermap/weather-icons/` +
                      icon +
                      `.svg?v=1`
                  "
                  v-for="(icon, ind2) in getWeatherIcon(day.weather_symbol_day)"
                  :key="ind2"
                />
              </div>
              <div class="wind">
                &nbsp;&nbsp;&nbsp;
                <f7-icon
                  f7="location_north"
                  :style="formatWindDirection(day.winddirection)"
                ></f7-icon>
                {{ formatWind(day.windgust) }} m/s &nbsp;&nbsp;&nbsp;
                <span v-if="day.rain > 1">
                  <f7-icon f7="cloud_heavyrain"></f7-icon>
                  {{ formatWind(day.rain) }} mm
                </span>
              </div>
            </f7-col>
          </f7-row>
          <f7-row>
            <f7-col>
              <div class="subtitle"></div>
            </f7-col>
          </f7-row>
          <f7-row>
            <f7-col>
              <div class="details"></div>
            </f7-col>
          </f7-row>
        </f7-col>
      </f7-row>
      <f7-row class="middle">
        <f7-col width="35" class="widget news">
          <div class="updated">{{ formatLastNewsUpdated(articles) }}</div>
          <f7-block-title>{{ translate('news') }}</f7-block-title>
          <div class="article-list">
            <f7-row v-for="(article, index) in articles" :key="index" @click="showArticle(index)">
              <f7-col
                width="15"
                class="image"
                :style="
                  `background-image: url(` +
                    (article.urlToImage ? article.urlToImage : './static/news.jpg') +
                    `)`
                "
              ></f7-col>
              <f7-col width="70" class="headline">{{ formatHeadline(article.title) }}</f7-col>
              <f7-col width="15" class="published">{{
                formatPublishedTime(article.publishedAt)
              }}</f7-col>
            </f7-row>
          </div>
        </f7-col>
        <f7-col width="30" class="widget calendar">
          <f7-block>
            <f7-block-title>{{ translate('calendar') }}</f7-block-title>
            <f7-row
              v-for="(event, index) in events"
              :key="index"
              :class="formatCalendarClass(event.start)"
            >
              <f7-col width="40" class="calendar-time">{{
                formatCalendarTime(event.start)
              }}</f7-col>
              <f7-col width="60" class="calendar-event" v-text="event.summary"></f7-col>
            </f7-row>
          </f7-block>
        </f7-col>
        <f7-col v-if="quotes" width="35" class="widget stocks">
          <div class="updated">{{ formatLastStockUpdated(quotes) }}</div>
          <f7-block-title>{{ translate('stocks') }}</f7-block-title>
          <f7-row
            v-for="(quote, index) in quotes"
            :key="index"
            :class="quote.price.quoteType"
            @click="showStock(index)"
          >
            <f7-col width="20" class="symbol">{{ formatStockSymbol(quote.price.symbol) }}</f7-col>
            <f7-col width="40" class="name">{{ quote.price.shortName }}</f7-col>
            <f7-col width="20" class="price"
              >{{ quote.price.currencySymbol }}
              {{ formatStockPrice(quote.price.regularMarketPrice) }}</f7-col
            >
            <f7-col width="15">
              <f7-chip
                :text="formatPercent(quote.price.regularMarketChangePercent)"
                :color="formatStockColor(quote.price.regularMarketChangePercent)"
              ></f7-chip>
            </f7-col>
          </f7-row>
        </f7-col>
        <f7-col
          v-if="tibber && tibber.currentSubscription.priceInfo.today"
          width="35"
          class="widget prices"
        >
          <f7-block>
            <f7-block-title>{{ translate('prices') }}</f7-block-title>
            <la-cartesian :data="priceChart">
              <defs>
                <linearGradient id="color-id" x1="0" y1="0" x2="0" y2="1">
                  <stop stop-color="#f94144" offset="0%" stop-opacity="1"></stop>
                  <stop stop-color="#ffe74c" offset="50%" stop-opacity="1"></stop>
                  <stop stop-color="#42b983" offset="100%" stop-opacity="1"></stop>
                </linearGradient>
              </defs>
              <la-line curve :width="5" prop="value" color="url(#color-id)"></la-line>
              <la-x-axis
                prop="name"
                color="#666677"
                :format="(v) => v.padStart(2, '0')"
              ></la-x-axis>
              <la-y-marker
                v-if="currentPrice"
                dashed
                :value="currentPrice.value"
                :label="currentPrice.label"
                :color="formatEnergyColor(currentPrice.level)"
              ></la-y-marker>
              <la-y-axis
                color="#666677"
                :interval="5"
                :format="(v) => (Math.round(v * 10) / 10).toFixed(2)"
              ></la-y-axis>
            </la-cartesian>
          </f7-block>
        </f7-col>
      </f7-row>
      <f7-row class="bottom">
        <f7-col width="30" class="widget sonos">
          <f7-row v-if="sonos.track">
            <f7-col width="25" class="text-align-right">
              <img :src="getAlbumCover" class="image" />
            </f7-col>
            <f7-col width="50" class="text-align-left">
              <div class="title">{{ sonos.track.title }}</div>
              <div class="artist">{{ sonos.track.artist }}</div>
              <div class="album">{{ sonos.track.album }}</div>
              <f7-progressbar
                class="track-progress"
                :progress="sonos.position * sonos.ratio"
              ></f7-progressbar>
              <div class="controls">
                <div
                  @click="volumeDown"
                  @mousedown="volumeDownStart"
                  @mouseup="volumeDownStop"
                  style="margin-right: 0.2em"
                >
                  <f7-icon material="volume_down"></f7-icon>
                </div>
                <div style="width: 10em; margin-top: 2.3em">
                  <f7-progressbar color="gray" :progress="sonos.volume * 5"></f7-progressbar>
                </div>
                <div
                  @click="volumeUp"
                  @mousedown="volumeUpStart"
                  @mouseup="volumeUpStop"
                  style="margin-left: 0.5em"
                >
                  <f7-icon material="volume_up"></f7-icon>
                </div>
              </div>
            </f7-col>
            <f7-col width="25" class="text-align-center">
              <div @click="playPause">
                <f7-icon :material="getSonosStateIcon"></f7-icon>
              </div>
              <div @click="playNext">
                <f7-icon material="skip_next"></f7-icon>
              </div>
            </f7-col>
          </f7-row>
          <f7-row v-if="!sonos.track">
            <f7-col width="20" class="text-align-right">
              <f7-skeleton-block class="image"></f7-skeleton-block>
            </f7-col>
            <f7-col width="60" class="text-align-left">
              <f7-skeleton-block
                class="subtitle"
                style="width: 8em; margin-top: 0.5em"
              ></f7-skeleton-block>
              <f7-skeleton-block
                class="details"
                style="width: 15em; margin-top: 0.5em"
              ></f7-skeleton-block>
            </f7-col>
            <f7-col width="20" class="text-align-left">
              <f7-icon :material="getSonosStateIcon"></f7-icon>
            </f7-col>
          </f7-row>
        </f7-col>
        <f7-col width="20" class="widget playlist">
          <f7-block-title></f7-block-title>
          <f7-row v-if="this.config">
            <f7-col width="50" v-for="(item, index) in this.config.playlist" :key="index">
              <f7-button
                :icon-f7="item.icon"
                :popover-open="'.popover-playlist-' + index"
                large
                fill
                >{{ item.title }}</f7-button
              >
            </f7-col>
            <f7-popover
              :class="'popover-playlist-' + index"
              v-for="(item, index) in this.config.playlist"
              :key="'popup-' + index"
              :backdrop="false"
            >
              <f7-list>
                <f7-list-item
                  @click="startPlaylistItem(index, item, listItem)"
                  v-for="(listItem, listIndex) in item.list"
                  :key="index + '-' + listIndex"
                  :title="listItem[1]"
                ></f7-list-item>
              </f7-list>
            </f7-popover>
          </f7-row>
        </f7-col>
        <f7-col width="50" class="widget home">
          <f7-row class="justify-content-space-around">
            <f7-col
              class="electricity"
              v-if="tibber && tibber.currentSubscription.priceInfo.current"
            >
              {{ translate('price') }}<br />
              <f7-gauge
                type="circle"
                :value="tibber.currentSubscription.priceInfo.current.total"
                :value-text="formatEnergyPrice(tibber.currentSubscription.priceInfo.current.total)"
                :value-text-color="
                  formatEnergyColor(tibber.currentSubscription.priceInfo.current.level)
                "
                :border-color="
                  formatEnergyColor(tibber.currentSubscription.priceInfo.current.level)
                "
                border-bg-color="#333333"
                :border-width="7"
                size="140"
                :label-text="
                  formatEnergyDate(tibber.currentSubscription.priceInfo.current.startsAt)
                "
                label-text-color="#888888"
              ></f7-gauge>
            </f7-col>
            <f7-col class="solar" v-if="tibber2 && tibber2.inverter">
              {{ translate('production') }}<br />
              <f7-gauge
                type="circle"
                :value="parseFloat(tibber2.inverter.bubble.percent / 100)"
                :value-text="tibber2.inverter.bubble.value + ` W`"
                :value-text-color="formatSolarColor(tibber2.inverter.bubble.percent)"
                :border-color="formatSolarColor(tibber2.inverter.bubble.percent)"
                border-bg-color="#333333"
                :border-width="7"
                size="140"
                :label-text="
                  parseFloat(tibber2.inverterProduction.keyFigures[0].valueText).toFixed(1) +
                    ` ` +
                    tibber2.inverterProduction.keyFigures[0].unitText +
                    ` ` +
                    translate('today')
                "
                label-text-color="#888888"
              ></f7-gauge>
            </f7-col>
            <f7-col class="consumption" v-if="tibber2 && tibberFeed">
              {{ translate('consumption') }}<br />
              <f7-gauge
                type="circle"
                :value="formatPowerValue()"
                :value-text="formatPowerText(tibberFeed.power)"
                :value-text-color="formatPowerColor(tibberFeed.power, tibberFeed.maxPower)"
                :border-color="formatPowerColor(tibberFeed.power, tibberFeed.maxPower)"
                border-bg-color="#333333"
                :border-width="7"
                size="140"
                :label-text="
                  parseFloat(tibberFeed.accumulatedConsumption).toFixed(1) +
                    ` kWh ` +
                    translate('today')
                "
                label-text-color="#888888"
              ></f7-gauge>
            </f7-col>
            <f7-col class="thermo" v-if="tibber2 && tibber2.thermostat">
              <div>
                <div class="arrow" @click="setThermo(+0.5)">
                  <f7-icon material="keyboard_arrow_up"></f7-icon>
                </div>
                <div class="temp">&nbsp;{{ tibber2.thermostat.state.comfortTemperature }}&deg;</div>
                <div class="current">
                  {{ tibber2.thermostat.temperatureSensor.measurement.value }}&deg;
                </div>
                <div v-if="false" :class="fanpower ? 'fan on' : 'fan'" @click="setFanLevel()">
                  <f7-icon material="toys"></f7-icon>
                </div>
                <div class="arrow" @click="setThermo(-0.5)">
                  <f7-icon material="keyboard_arrow_down"></f7-icon>
                </div>
              </div>
            </f7-col>
            <f7-col class="car" v-if="tibber3 && tibber3.electricVehicles.length > 0">
              <div class="charge" v-for="(vehicle, index) in tibber3.electricVehicles" :key="index">
                <img :src="vehicle.imgUrl" :class="vehicle.isAlive ? '' : 'dead'" />
                <span v-html="formatBatteryText(vehicle.batteryText)"></span>
              </div>
            </f7-col>
          </f7-row>
          <!-- <f7-block-title>LIGHTS</f7-block-title>
          <f7-row class="justify-content-space-around">
            <f7-col>
              <f7-button @click="setLights('tv')" large fill>TV</f7-button>
            </f7-col>
            <f7-col>
              <f7-button @click="setLights('dinner')" large fill>DINNER</f7-button>
            </f7-col>
            <f7-col>
              <f7-button @click="setLights('evening')" large fill>EVENING</f7-button>
            </f7-col>
          </f7-row>
          <f7-row class="justify-content-space-around">
            <f7-col>
              <f7-button @click="setLights('work')" large fill>WORK</f7-button>
            </f7-col>
            <f7-col>
              <f7-button @click="setLights('dim')" large fill>DIM</f7-button>
            </f7-col>
            <f7-col>
              <f7-button @click="setLights('off')" large fill>OFF</f7-button>
            </f7-col>
          </f7-row>-->
        </f7-col>
      </f7-row>
    </f7-block>
    <!-- Toolbar-->
    <f7-toolbar bottom>
      <f7-link @click="rebootServer">{{ translate('reboot') }}</f7-link>
      <f7-link @click="restartServer">{{ translate('restart') }}</f7-link>
      <f7-link @click="toggleBackground">{{
        this.showBackground ? translate('showdashboard') : translate('showbackground')
      }}</f7-link>
      <f7-link @click="sleepServer">{{ translate('sleep') }}</f7-link>
      <f7-link @click="refreshPage">{{ translate('refresh') }}</f7-link>
    </f7-toolbar>

    <f7-popup class="article-popup" push>
      <f7-page v-if="currentArticle">
        <f7-navbar :title="currentArticle.title">
          <f7-nav-right>
            <f7-link popup-close>{{ translate('close') }}</f7-link>
          </f7-nav-right>
        </f7-navbar>
        <f7-block class="justify-content-center">
          <img
            class="article-image justify-content-center"
            :src="currentArticle.urlToImage"
            v-if="currentArticle.urlToImage"
          />
        </f7-block>
        <f7-block
          class="article-ingress"
          v-html="formatArticleContent(currentArticle.description)"
        ></f7-block>
        <f7-block
          class="article-content"
          v-html="formatArticleContent(currentArticle.content)"
        ></f7-block>
        <f7-block>
          <f7-link external target="news" :href="currentArticle.url"
            >Read full article at {{ currentArticle.source.name }}</f7-link
          >
        </f7-block>
      </f7-page>
    </f7-popup>
    <f7-popup class="weather-popup" push>
      <f7-page>
        <f7-navbar>
          <f7-nav-right>
            <f7-link popup-close>Close</f7-link>
          </f7-nav-right>
        </f7-navbar>
        <iframe
          v-if="weatherurl"
          :src="weatherurl"
          frameborder="0"
          width="100%"
          height="100%"
        ></iframe>
      </f7-page>
    </f7-popup>
  </f7-page>
</template>

<script>
import axios from 'axios'
import moment from 'moment-timezone'
import io from 'socket.io-client'
import weatherfunctions from '../js/weather'
import { Cartesian, Line, XAxis, YAxis, YMarker } from 'laue'

export default {
  components: {
    LaCartesian: Cartesian,
    LaLine: Line,
    LaXAxis: XAxis,
    LaYAxis: YAxis,
    LaYMarker: YMarker,
  },
  data() {
    return {
      showBackground: false,
      currentTime: null,
      currentDay: null,
      currentArticle: null,
      remoteTime: null,
      remoteAbbr: null,
      sonos: {
        state: null,
        track: null,
        volume: 0,
        position: 0,
        ratio: 1,
        increment: 0,
        timer: null,
      },
      volumeTimer: null,
      tibber: null,
      tibber2: null,
      tibber3: null,
      tibberFeed: null,
      weather: null,
      weatherurl: null,
      fanpower: false,
      forecast: null,
      quotes: null,
      articles: null,
      events: null,
      asleep: false,
      last_active: null,
      config: null,
      currentCondition: null,
      socket: io(document.location.hostname + ':3000'),
      translations: {
        en: {
          news: 'News',
          calendar: 'Calendar',
          stocks: 'Stocks',
          price: 'Price',
          production: 'Production',
          consumption: 'Consumption',
          prices: 'Electricity Prices',
          today: 'today',
          updated: 'Updated',
          reboot: 'Reboot',
          restart: 'Restart server',
          showbackground: 'Show background',
          showdashboard: 'Show dashboard',
          sleep: 'Sleep',
          refresh: 'Refresh page',
          close: 'Close',
          calformats: {
            sameDay: '[Today at] LT',
            nextDay: '[Tomorrow at] LT',
            nextWeek: 'dddd [at] LT',
            lastDay: '[Yesterday] [at] LT',
            lastWeek: '[Last] dddd',
            sameElse: 'lll',
          },
          calrelative: {
            future: 'in %s',
            past: '%s ago',
            s: 'a few seconds',
            ss: '%d seconds',
            m: 'a minute',
            mm: '%d min',
            h: 'an hour',
            hh: '%d hours',
            d: 'a day',
            dd: '%d days',
            w: 'a week',
            ww: '%d weeks',
            M: 'a month',
            MM: '%d months',
            y: 'a year',
            yy: '%d years',
          },
        },
        sv: {
          news: 'Nyheter',
          calendar: 'Kalendar',
          stocks: 'Börs',
          price: 'Elpris',
          production: 'Produktion',
          consumption: 'Förbrukning',
          prices: 'Elpris',
          today: 'idag',
          updated: 'Uppdaterad',
          reboot: 'Starta om',
          restart: 'Ladda om server',
          showbackground: 'Visa bakgrund',
          showdashboard: 'Visa board',
          sleep: 'Stäng skärm',
          refresh: 'Ladda om sidan',
          close: 'Stäng',
          calformats: {
            sameDay: '[Idag] LT',
            nextDay: '[Imorgon] LT',
            nextWeek: 'dddd LT',
            lastDay: '[Igår] LT',
            lastWeek: '[Senast] dddd',
            sameElse: 'lll',
          },
          calrelative: {
            future: 'om %s',
            past: '%s sedan',
            s: 'en sekund',
            ss: '%d sek',
            m: 'en minut',
            mm: '%d min',
            h: 'en timma',
            hh: '%d timmar',
            d: 'en dag',
            dd: '%d dagar',
            w: 'en vecka',
            ww: '%d veckor',
            M: 'en månad',
            MM: '%d månader',
            y: 'ett år',
            yy: '%d år',
          },
        },
      },
    }
  },
  computed: {
    getAlbumCover() {
      if (this.sonos.track.albumArtURL) {
        return this.sonos.track.albumArtURL
      } else if (this.sonos.track.albumArtURI) {
        return this.sonos.track.albumArtURI
      } else {
        return 'static/sonos.png'
      }
    },
    getSonosStateIcon() {
      if (this.sonos.state == 'playing') {
        this.sonos.increment = 1
        return 'pause'
      } else if (this.sonos.state == 'transitioning') {
        return 'hourglass_empty'
      } else {
        this.sonos.increment = 0
        return 'play_arrow'
      }
    },
    currentConditionImage() {
      if (this.currentCondition) {
        return 'static/openweathermap/' + this.currentCondition.icon + '.svg'
      }
    },
    priceChart() {
      const values = []
      if (this.tibber && this.tibber.currentSubscription.priceInfo) {
        for (const val of this.tibber.currentSubscription.priceInfo.today) {
          if (moment(val.startsAt).diff(moment()) > -(2 * 60 * 60 * 1000)) {
            values.push({
              name: moment(val.startsAt).format('H'),
              value: val.total,
            })
          }
        }
        for (const val of this.tibber.currentSubscription.priceInfo.tomorrow) {
          if (moment(val.startsAt).diff(moment()) < 12 * 60 * 60 * 1000) {
            values.push({
              name: moment(val.startsAt).format('H'),
              value: val.total,
            })
          }
        }
      }
      return values
    },
    currentPrice() {
      if (this.tibber && this.tibber.currentSubscription.priceInfo.current) {
        const curr = this.tibber.currentSubscription.priceInfo.current
        return {
          label: moment(curr.startsAt).format('H:mm') + ': ' + curr.total.toFixed(2) + ' kr',
          value: curr.total,
          level: curr.level,
        }
      } else {
        return false
      }
    },
  },
  methods: {
    getBackground() {
      var self = this
      let hour = new Date().getHours()
      if (this.config && this.config.cam && this.config.cam.url && hour < 22 && hour > 6) {
        let cachebuster = Math.round(new Date().getTime() / 1000)
        let imgurl =
          this.config.cam.url +
          (this.config.cam.url.indexOf('?') > -1 ? '&' : '?') +
          'counter=' +
          cachebuster
        if (cachebuster % 2 || !this.showBackground) {
          self.$$('.page-content')[0].style.backgroundImage = 'url(' + imgurl + ')'
          setTimeout(function() {
            if (typeof self.$$('.page-current')[0] != 'undefined') {
              self.$$('.page-current')[0].style.backgroundImage = ''
            }
          }, 1000)
        } else {
          if (this.showBackground && self.$$('.page-current').length > 0) {
            self.$$('.page-current')[0].style.backgroundImage = 'url(' + imgurl + ')'
            setTimeout(function() {
              if (typeof self.$$('.page-content')[0] != 'undefined') {
                self.$$('.page-content')[0].style.backgroundImage = ''
              }
            }, 1000)
          }
        }
      } else if (this.config && this.config.background && this.config.background.url) {
        this.$$('.page-content,.container::before')[0].style.backgroundImage =
          'url(' + this.config.background.url + ')'
      } else {
        this.$$('.page-content,.container::before')[0].style.backgroundImage =
          'url(./static/night.jpg)'
      }
    },
    updateRealtime() {
      if (this.showBackground) {
        this.getBackground()
      }
      setTimeout(this.updateRealtime, 1000 * 10)
    },
    updateMinutly() {
      this.getQuotes()
      this.getNews()
      this.getWeather()
      this.getTibber()
      let hour = new Date().getHours()
      if (hour > 2 && hour < 8) {
        setTimeout(this.updateMinutly, 1000 * 60 * 30)
      } else {
        setTimeout(this.updateMinutly, 1000 * 60 * 10)
      }
      const time_since_active = new Date().getTime() - this.last_active
      if (this.config.autosleep && time_since_active > 30000 && this.asleep == false) {
        const split_time = this.config.autosleep.split('-')
        if (
          (split_time[0] > split_time[1] && !(hour >= split_time[1] && hour < split_time[0])) ||
          (split_time[0] < split_time[1] && hour >= split_time[0] && hour < split_time[1])
        ) {
          this.sleepServer()
        }
      }
    },
    updateHourly() {
      this.getBackground()
      if (this.config && this.config.netatmo.forecast.device_id) {
        this.getNetatmoForecast()
      } else {
        this.getForecast()
      }
      this.getCondition()
      this.getCalendar()
      this.getTibber2()
      setTimeout(this.updateHourly, 1000 * 60 * 60)
    },
    update12Hour() {
      this.getTibber3()
      setTimeout(this.update12Hour, 1000 * 60 * 60 * 12)
    },
    refreshPage() {
      document.location.reload()
    },
    toggleBackground() {
      this.showBackground = !this.showBackground
    },
    restartServer() {
      this.socket.emit('restart')
    },
    rebootServer() {
      this.socket.emit('reboot')
    },
    sleepServer() {
      this.socket.emit('sleep')
      console.log('sleep')
      this.wakeupListener()
      this.asleep = true
    },
    wakeupListener() {
      let that = this
      window.addEventListener('touchstart', function onFirstTouch() {
        that.socket.emit('wakeup')
        console.log('wakeup')
        window.removeEventListener('touchstart', onFirstTouch, false)
        that.last_active = new Date().getTime()
        that.asleep = false
      })
    },
    getWeatherIcon(symbol) {
      return weatherfunctions.getIcon(symbol)
    },
    translate(val) {
      if (this.config && this.config.language) {
        return this.translations[this.config.language][val]
      } else {
        return this.translations['en'][val]
      }
    },
    formatFromNow(datetime) {
      return moment.utc(datetime * 1000).fromNow()
    },
    formatWind(windkph) {
      if (windkph) {
        return (windkph / 3.6).toFixed(0)
      } else {
        return '- '
      }
    },
    formatWindDirection(angle) {
      return 'transform: rotate(' + (angle - 180) + 'deg);'
    },
    formatCondition(weather) {
      return weather.charAt(0).toUpperCase() + weather.slice(1)
    },
    formatPressure(pre, trend) {
      return pre.toFixed(0)
    },
    formatPressureIcon(trend) {
      if (trend == 'up') {
        return 'arrow_up_right'
      } else if (trend == 'down') {
        return 'arrow_down_right'
      } else {
        return 'arrow_right'
      }
    },
    formatCO2(co) {
      return co ? co.toFixed(0) : null
    },
    formatFeelsLike(weather, forecast) {
      if (weather && weather.outdoor && weather.outdoor.wind_speed) {
        return weatherfunctions.getFeelslike(
          weather.outdoor.Temperature,
          weather.outdoor.wind_speed / 3.6
        )
      } else if (weather && forecast && forecast.current_windgust) {
        return weatherfunctions.getFeelslike(
          weather.outdoor.Temperature,
          forecast.current_windgust / 3.6
        )
      } else {
        return '-'
      }
    },
    formatPercent(perc) {
      if (isNaN(perc)) {
        return '-'
      }
      let output = perc * 100
      output = Math.abs(output).toFixed(1).length > 3 ? output.toFixed(0) : output.toFixed(1)
      output = output + '%'
      if (perc > 0) {
        return '+' + output
      } else {
        return output
      }
    },
    formatStockColor(perc) {
      if (perc > 0) {
        return 'green'
      } else if (perc < 0) {
        return 'red'
      } else {
        return 'grey'
      }
    },
    formatStockPrice(price) {
      return price ? price.toFixed(0) : null
    },
    formatStockSymbol(symbol) {
      return symbol.replace('^', '')
    },
    formatLastStockUpdated(quotes) {
      if (quotes && Object.keys(quotes).length > 0) {
        return moment(quotes[Object.keys(quotes)[0]].price.regularMarketTime).calendar(
          null,
          this.translations[this.config.language].calformats
        )
      }
    },
    formatLastNewsUpdated(articles) {
      if (articles && Object.keys(articles).length > 0) {
        return moment(articles[Object.keys(articles)[0]].publishedAt).calendar(
          null,
          this.translations[this.config.language].calformats
        )
      }
    },
    formatPublishedTime(datetime) {
      return moment(datetime).format('LT')
    },
    formatHeadline(headline) {
      if (headline.length > 150) {
        return headline.substring(0, 150) + '...'
      } else {
        return headline
      }
    },
    formatCalendarTime(datetime) {
      return moment(datetime).calendar(null, this.translations[this.config.language].calformats)
    },
    formatCalendarClass(datetime) {
      return moment(datetime).calendar(null, {
        sameDay: '[sameday]',
        nextDay: '[nextday]',
        nextWeek: '[nextweek]',
        lastDay: '[lastday]',
        lastWeek: '[lastweek]',
        sameElse: '[sameelse]',
      })
    },
    formatCalendarText(text) {
      const symbols = {
        tennis: '&#127934;',
        party: '&#129395;',
        birthday: '&#127874;',
        delivery: '&#128666;',
        dinner: '&#127869;',
        lunch: '&#127860;',
        haircut: '&#128135;',
        gym: '&#129336;',
        massage: '&#128134;',
      }
      for (const s in symbols) {
        let re = new RegExp('(' + s + ')', 'gi')
        text = text.replace(re, '&nbsp;$1&nbsp;' + symbols[s])
      }
      return text
    },
    formatArticleContent(text) {
      return text ? text.replace(/\n/g, '<br>') : null
    },
    formatBatteryText(text) {
      return text.replace('(', '<br>').replace(')', '')
    },
    formatEnergyPrice(price) {
      if (price < 1) {
        return (price * 100).toFixed(1) + ' öre'
      } else {
        return (price * 100).toFixed(0) + ' öre'
      }
    },
    formatEnergyDate(datetime) {
      return moment.utc(datetime).fromNow()
    },
    formatEnergyColor(level) {
      if (level == 'VERY_CHEAP') {
        return '#3fcf40'
      } else if (level == 'CHEAP') {
        return '#4c9f50'
      } else if (level == 'NORMAL') {
        return '#ffb477'
      } else if (level == 'EXPENSIVE') {
        return '#f57441'
      } else if (level == 'VERY_EXPENSIVE') {
        return '#f83e30'
      }
    },
    formatSolarColor(percent) {
      if (percent > 80) {
        return '#3fcf40'
      } else if (percent > 60) {
        return '#4c9f50'
      } else if (percent > 40) {
        return '#ffb477'
      } else if (percent > 20) {
        return '#f57441'
      } else if (percent > 0) {
        return '#f83e30'
      } else {
        return '#888888'
      }
    },
    formatPowerValue() {
      if (this.tibberFeed.power > 0) {
        return parseFloat(this.tibberFeed.power / this.tibberFeed.maxPower)
      } else if (this.tibberFeed.powerProduction > 0) {
        return '-' + parseFloat(this.tibberFeed.powerProduction / this.tibberFeed.maxPower)
      }
    },
    formatPowerText(watt) {
      if (watt > 0 && watt < 10000) {
        return watt + ' W'
      } else if (watt > 0) {
        return (watt / 1000).toFixed(1) + ' kW'
      } else {
        return '-' + parseFloat(this.tibberFeed.powerProduction) + ' W'
      }
    },
    formatPowerColor(watt, max) {
      if (watt > max * 0.9) {
        return '#f83e30'
      } else if (watt > max * 0.7) {
        return '#f57441'
      } else if (watt > max * 0.5) {
        return '#ffb477'
      } else if (watt > max * 0.3) {
        return '#4c9f50'
      } else {
        return '#3fcf40'
      }
    },
    updateTime() {
      this.currentTime = moment()
        .tz(this.config.time.localzone)
        .format('LT')
      if (this.config.language == 'sv') {
        this.currentDay = moment()
          .tz(this.config.time.localzone)
          .format('ddd D MMMM')
      } else {
        this.currentDay = moment()
          .tz(this.config.time.localzone)
          .format('ddd D MMMM')
      }
      if (this.config && this.config.time) {
        this.remoteTime = moment()
          .tz(this.config.time.remotezone)
          .format('LT')
        this.remoteAbbr = moment()
          .tz(this.config.time.remotezone)
          .format('z')
      }
      setTimeout(this.updateTime, 60 - moment().format('mm') * 1000)
    },

    loadConfig() {
      this.socket.emit('config')
    },

    getNetatmoForecast() {
      if (this.config && this.config.netatmo.forecast.device_id) {
        let url =
          'https://app.netatmo.net/api/simplifiedfuturemeasure?device_id=' +
          this.config.netatmo.forecast.device_id +
          '&locale=' +
          this.config.netatmo.forecast.locale +
          '&module_id=' +
          this.config.netatmo.forecast.module_id
        let options = {
          headers: {
            Authorization: 'Bearer ' + this.config.netatmo.forecast.bearer,
          },
        }
        axios
          .get(url, options)
          .then((response) => {
            if (response.data && response.data.body) {
              this.forecast = response.data.body
              if (this.forecast.forecastDays) {
                this.forecast.forecastDays = this.forecast.forecastDays.slice(0, 3)
              }
            }
          })
          .catch((err) => {
            console.log(err)
          })
      }
    },

    getCondition() {
      if (this.config && this.config.weather.openweathermap.key) {
        axios
          .get(this.config.weather.openweathermap.url + this.config.weather.openweathermap.key)
          .then((response) => {
            if (response.data) {
              this.currentCondition = response.data.weather[0]
              if (!this.config.netatmo.client_id) {
                // Load as current weather
                this.weather = {
                  indoor: {
                    time_utc: response.data.dt,
                    Temperature: (response.data.main.temp - 273).toFixed(1), //Kelvin to celsius
                    CO2: null,
                    Humidity: response.data.main.humidity,
                    Noise: null,
                    Pressure: response.data.main.pressure,
                    AbsolutePressure: null,
                    min_temp: (response.data.main.temp_min - 273).toFixed(1),
                    max_temp: (response.data.main.temp_max - 273).toFixed(1),
                    date_max_temp: response.data.dt,
                    date_min_temp: response.data.dt,
                    temp_trend: null,
                    pressure_trend: null,
                  },
                  outdoor: {
                    time_utc: response.data.dt,
                    Temperature: (response.data.main.temp - 273).toFixed(1),
                    Humidity: response.data.main.humidity,
                    min_temp: (response.data.main.temp_min - 273).toFixed(1),
                    max_temp: (response.data.main.temp_max - 273).toFixed(1),
                    date_max_temp: response.data.dt,
                    date_min_temp: response.data.dt,
                    temp_trend: null,
                    wind_deg: response.data.wind ? response.data.wind.deg : null,
                    wind_speed: response.data.wind ? response.data.wind.speed : null,
                  },
                }
              }
            }
          })
      }
    },

    getForecast() {
      if (this.config && this.config.weather) {
        axios.get(this.config.weather.met_no.url).then((response) => {
          if (response.data && response.data.properties && response.data.properties.timeseries) {
            this.forecast = response.data.properties.timeseries.slice(0, 4)
          }
        })
      }
    },

    getQuotes() {
      if (this.config && this.config.quotes.length > 0) {
        this.socket.emit('quotes', this.config.quotes)
      }
    },
    getNews() {
      this.socket.emit('news')
    },
    getWeather() {
      this.socket.emit('weather')
    },
    getTibber() {
      this.socket.emit('tibber')
    },
    getTibber2() {
      this.socket.emit('tibber2')
    },
    getTibber3() {
      this.socket.emit('tibber3')
    },
    getCalendar() {
      this.socket.emit('calendar')
    },
    playPause() {
      this.socket.emit('playpause')
    },
    playNext() {
      this.sonos.position = 0
      this.socket.emit('playnext')
    },
    playShuffle() {
      this.socket.emit('playshuffle')
    },
    volumeDown() {
      this.socket.emit('volumedown')
    },
    volumeDownStart() {
      this.volumeTimer = setInterval(() => {
        this.socket.emit('volumedown')
      }, 300)
    },
    volumeDownStop() {
      clearInterval(this.volumeTimer)
    },
    volumeUp() {
      this.socket.emit('volumeup')
    },
    volumeUpStart() {
      this.volumeTimer = setInterval(() => {
        this.socket.emit('volumeup')
      }, 300)
    },
    volumeUpStop() {
      clearInterval(this.volumeTimer)
    },
    setLights(mode) {
      this.socket.emit('setLights', mode)
    },
    setThermo(change) {
      if (this.tibber2.thermostat) {
        this.tibber2.thermostat.state.comfortTemperature =
          this.tibber2.thermostat.state.comfortTemperature + change
        let temp = this.tibber2.thermostat.state.comfortTemperature
        this.socket.emit('setthermo', temp)
      }
    },
    setFanLevel() {
      this.fanpower = !this.fanpower
      this.socket.emit('setfan', this.fanpower)
    },
    showPlaying(title, icon) {
      if (typeof icon == 'undefined') {
        icon = 'music_note_2'
      }
      this.$f7.toast
        .create({
          icon: '<i class="f7-icons">' + icon + '</i>',
          text: title,
          position: 'center',
          closeTimeout: 5000,
          cssClass: 'connected',
        })
        .open()
    },
    startPlaylistItem(index, item, listItem) {
      if (item.type == 'spotify') {
        this.socket.emit('playURI', listItem[0])
        this.showPlaying(listItem[1], item.icon)
      } else if (item.type == 'radio') {
        this.socket.emit('playRadio', listItem)
        this.showPlaying(listItem[1], item.icon)
      }
      this.$f7.popup.get('.popover-playlist-' + index).close()
    },
    startPlaylist(item) {
      if (item.type == 'spotify') {
        let selected = item.list[(Math.random() * item.list.length) | 0]
        this.socket.emit('playURI', selected[0])
        this.showPlaying(selected[1], item.icon)
      } else if (item.type == 'radio') {
        let selected = item.list[(Math.random() * item.list.length) | 0]
        this.socket.emit('playRadio', selected)
        this.showPlaying(selected[1], item.icon)
      }
    },

    showArticle(index) {
      this.currentArticle = this.articles[index]
      if (this.currentArticle.description) {
        this.$f7.popup.open('.article-popup', true)
      } else {
        window.open(this.currentArticle.url)
      }
    },
    showStock(index) {
      this.current_stock = this.quotes[index]
      window.open(
        'https://finance.yahoo.com/chart/' + encodeURIComponent(this.current_stock.price.symbol)
      )
    },
    showWeather() {
      if (this.config && this.config.weather.popup) {
        // this.$f7.popup.open('.weather-popup', true)
        // this.weatherurl = this.config.weather.popup.url
        window.open(this.config.weather.popup.url)
      }
    },
    initSocket() {
      var self = this
      this.socket.on('SONOS_TRACK', (track) => {
        this.$set(this.sonos, 'position', 0)
        if (track.position) {
          this.$set(this.sonos, 'ratio', 100 / track.duration)
          this.$set(this.sonos, 'position', track.position)
        }
        this.$set(this.sonos, 'track', track)
      })
      this.socket.on('SONOS_STATE', (state) => {
        this.$set(this.sonos, 'state', state)
      })
      this.socket.on('SONOS_VOLUME', (volume) => {
        this.$set(this.sonos, 'volume', volume)
      })
      this.socket.on('WEATHER', (weather) => {
        this.weather = weather
      })
      this.socket.on('QUOTES', (quotes) => {
        this.quotes = quotes
        // console.log(quotes)
      })
      this.socket.on('NEWS', (articles) => {
        this.articles = articles
      })
      this.socket.on('CALENDAR', (events) => {
        this.events = events
      })
      this.socket.on('TIBBER', (events) => {
        this.tibber = events
        // console.log(events)
      })
      this.socket.on('TIBBER2', (events) => {
        this.tibber2 = events
        // console.log(events)
      })
      this.socket.on('TIBBER3', (events) => {
        this.tibber3 = events
        // console.log(events)
      })
      this.socket.on('TIBBER_FEED', (data) => {
        this.tibberFeed = data
        // console.log(data)
      })
      this.socket.on('CONFIG', (config) => {
        this.config = config
        if (this.config.language) {
          moment.updateLocale(this.config.language, {
            relativeTime: this.translations[this.config.language].calrelative,
          })
        }

        // Load timers after config
        this.updateTime()
        this.updateHourly()
        this.updateMinutly()
        this.updateRealtime()
        this.update12Hour()
      })

      this.socket.on('disconnect', () => {
        this.$f7.toast
          .create({
            icon: '<i class="f7-icons">wifi_slash</i>',
            text: 'Disconnected',
            position: 'top',
            cssClass: 'disconnected',
          })
          .open()
      })
      this.socket.on('connect', () => {
        this.$f7.toast
          .create({
            icon: '<i class="f7-icons">wifi</i>',
            text: 'Connected',
            position: 'top',
            closeTimeout: 5000,
            cssClass: 'connected',
          })
          .open()
      })
      this.socket.on('refresh', () => {
        document.location.reload()
      })
    },
  },
  mounted() {
    this.last_active = new Date().getTime()
    this.initSocket()
    this.loadConfig()
    window.setInterval(() => {
      this.sonos.position = this.sonos.position + this.sonos.increment * 1
    }, 1000)
  },
}
</script>
