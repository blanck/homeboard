module.exports = {
  getIcon: (symbol) => {
    var icon = [];
    if ("" === symbol || void 0 === symbol) return null;
    var sun = (symbol = symbol.split("").map(function (digit) {
      return parseInt(digit)
    }))[0],
      clouds = symbol[1],
      rain = symbol[2],
      snow = symbol[3],
      hail = symbol[4],
      specials = symbol[5];
    1 === sun && 0 === clouds ? icon.push("fullSun") : 2 === sun && 0 === clouds ? icon.push("fullMoon") : 1 === sun ? icon.push("halfSun") : 2 === sun && icon.push("halfMoon");
    var underCloud = !1;
    switch (clouds) {
      case 0:
        break;
      case 1:
        underCloud = littleCloud();
        break;
      case 2:
        icon.push("lightCloud"),
          underCloud = littleCloud();
        break;
      case 3:
        icon.push("darkCloud"),
          underCloud = littleCloud()
    }
    if (underCloud) if (0 === snow && rain >= 1) switch (rain) {
      case 1:
        icon.push("lightRain");
        break;
      case 2:
        icon.push("heavyRain");
        break;
      case 3:
        icon.push("showerRain")
    } else if (snow >= 1 && rain >= 1) switch (Math.max(snow, rain)) {
      case 1:
        icon.push("lightSleet");
        break;
      case 2:
        icon.push("heavySleet");
        break;
      case 3:
        icon.push("showerSleet")
    } else if (snow >= 1) switch (snow) {
      case 1:
        icon.push("lightSnow");
        break;
      case 2:
        icon.push("heavySnow");
        break;
      case 3:
        icon.push("showerSnow")
    } else if (hail >= 1) switch (hail) {
      case 1:
        icon.push("lightHail");
        break;
      case 2:
        icon.push("heavyHail");
        break;
      case 3:
        icon.push("showerHail")
    }
    switch (specials) {
      case 1:
        0 === rain && 0 === snow && 0 === hail ? icon.push("bigFlash") : icon.push("flash");
        break;
      case 2:
        3 === clouds ? icon.push("warningBig") : icon.push("warning");
        break;
      case 3:
        icon.push("fog");
        break;
      case 4:
        snow >= 1 ? icon.push("windSnow") : icon.push("wind");
        break;
      case 5:
        icon.push("flooding")
    }
    function littleCloud() {
      return 0 === rain && 0 === snow && 0 === hail && 0 === specials ? (icon.push("littleCloudClose"), !1) : (icon.push("littleCloudOpen"), !0)
    }
    return icon
  },
  getFeelslike: (t,w) => {
    return parseInt(13.12+(0.615*parseFloat(t))-(11.37*(parseFloat(w)*3.6)**0.16)+(0.3965*parseFloat(t))*((parseFloat(w)*3.6)**0.16))
  }
}