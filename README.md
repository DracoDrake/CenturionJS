# Centurion Minicomputer Emulator

CenturionJS is a emulator for a Centurion Minicomputer written in Javascript.

## Building

```bash
git clone https://github.com/DracoDrake/CenturionJS
cd CenturionJS
npm install --dev
npm run build
```

## Usage

* Download ROM bin files into a 'roms' folder
from https://github.com/phire/centurion_isa/tree/main/roms<br>
  * `bootstrap_unscrambled.bin`
  * `Diag_F1_Rev_1.0.BIN`
  * `Diag_F2_Rev_1.0.BIN`
  * `Diag_F3_Rev_1.0.BIN`
  * `Diag_F4_1133CMD.BIN`

* From the main folder, run 'node ./build/Emulator.js'

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Special Thanks

* Alan Cox [ https://github.com/EtchedPixels ]
* Chris Giorgi
* tergav17 (Gavin) 
* Nakazoto(UsagiElectric) [ https://github.com/Nakazoto/CenturionComputer/wiki ]
* Ken Romaine

## Video

This was all started by Nakazoto(UsagiElectric) buying a Centruion Minicomputer.<br>
[Here are his videos, documenting the journey.](https://www.youtube.com/playlist?list=PLnw98JPyObn0wJFdbcRDP7LMz8Aw2T97V)<br>

## License
GPL-2.0
