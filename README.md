# zmanim

Glyphix app for the DT G1 watch: daily zmanim for cities in Eretz Yisrael, with the Hebrew date.

## Definitions

The app follows KosherKotlin 3.0 (LGPL-2.1), apart from the candle lighting minutes and Tzeit Chazon Ish, which were set by hand: `ItimLabinaCalculator`, and the `ITIM_LABINA` day plan of its app (`app/domain/ZmanimRepository.kt`).

| Zman | Definition |
|---|---|
| Sunrise, sunset | Sea level, on the Itim Labina horizon: semidiameter plus traced refraction, default climate |
| Alot 90, alot 72 | 18.9712 and 15.2193 degrees below that horizon |
| Misheyakir | 11.5 degrees below the geometric horizon |
| GRA day | Sunrise to sunset |
| MGA day | 72 fixed minutes before sunrise to 72 fixed minutes after sunset |
| Chatzot | Solar transit |
| Mincha gedola, ketana, plag | 6.5, 9.5, 10.75 GRA hours |
| Tzeit | 3.8217 degrees below that horizon |
| Rabbeinu Tam | 15.2193 degrees below that horizon |
| Candle lighting (Friday) | Before sunset: Jerusalem 40, Elad 30, Bnei Brak 20, other cities 18 minutes |
| Tzeit Shabbat (Shabbat) | 8.5 degrees below the geometric horizon, the library `tzais` that `isAssurBemelacha` uses |
| Tzeit Chazon Ish (Shabbat) | 9.29 degrees below the geometric horizon, after Chidushim Uviurim, Shabbat 7:15 (40 to 45 minutes after sunset) |

Seconds are dropped when a time is shown, as in the KosherKotlin app.

The picked city is saved. With no saved city the app asks for the location, which the watch only gets through a connected phone, and takes the nearest city; otherwise it uses Jerusalem.

## Layout

- `src/lib/zmanim.js` - the compact engine that runs on the watch.
- `src/lib/hebrew-date.js` - Hebrew date.
- `src/lib/cities.js` - generated city table.
- `tools/reference.mjs` - full port of the KosherKotlin calculation, too heavy for the watch.
- `tools/verify.mjs` - measures the engine against the reference, and the dates against the time zone database and ICU.
- `tools/render-icon.ps1` - draws the app icon and the day arrows.
- `tools/kk-data.json` - SPA tables and Menat atmospheres, extracted from KosherKotlin.

```
node tools/gen-cities.mjs
node tools/verify.mjs
```

ICU reports a 385-day year for 5806. A separate molad calculation gives 384 days, as this app does, so the check lists 385 errors in that year only.

## Build

Requires the Glyphix CLI (`gx`, installed in `dt-g1-research/tools/glyphix-toolchain`) and the `dtg1-c175r` device profile in `%APPDATA%\glyphix\devices`.

```
gx build -d dtg1-c175r -f
```

The package name `com.xfaith.calendar` reuses the menu slot of the stock calendar. Install steps are in `dt-g1-research/docs/DT-G1-notes.en.md`.

## Emulator

```
gx emulate -d dtg1-emu-466x466 --target=com.xfaith.calendar
```

`dtg1-emu-466x466` is `generic-watch-466x466` with a Hebrew font added, in `%APPDATA%\glyphix\devices`. The stock emulator fonts have no Hebrew.
