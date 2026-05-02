module.exports = {
  getIcon: function(symbol) {
    if ('' === symbol || void 0 === symbol) return null

    var digits = symbol.split('').map(function(d) {
      return parseInt(d, 10)
    })

    var sun = digits[0],
      clouds = digits[1],
      rain = digits[2],
      snow = digits[3],
      hail = digits[4],
      specials = digits[5]

    var sunMoonMap = ['', 'sun', 'moon']
    var specialsMap = ['', 'lightning', 'warning', 'fog', 'wind', 'flooding']

    var tempParts = []
    if (sun > 0) tempParts.push(sunMoonMap[sun])
    if (clouds > 0) tempParts.push(clouds + '-cloud')
    if (rain > 0) tempParts.push(rain + '-rain')
    if (snow > 0) tempParts.push(snow + '-snow')
    if (hail > 0) tempParts.push(hail + '-hail')
    if (specials > 0) tempParts.push(specialsMap[specials])

    var finalParts = tempParts

    // Lightning Rule
    if (specials === 1 && (rain > 0 || snow > 0 || hail > 0)) {
      finalParts = tempParts.filter(function(p) {
        return (
          p.includes('sun') || p.includes('moon') || p.includes('cloud') || p.includes('lightning')
        )
      })
    }
    // Sleet Rule
    else if (clouds > 0 && rain > 0 && snow > 0) {
      finalParts = tempParts.filter(function(p) {
        return !p.includes('rain')
      })
    }

    var iconName = finalParts.join('+')
    if (iconName.substring(0, 1) == '+') iconName = iconName.substring(1)

    return [iconName]
  },

  getFeelslike: (t, w) => {
    return parseInt(
      13.12 +
        0.615 * parseFloat(t) -
        11.37 * (parseFloat(w) * 3.6) ** 0.16 +
        0.3965 * parseFloat(t) * (parseFloat(w) * 3.6) ** 0.16
    )
  },
}
