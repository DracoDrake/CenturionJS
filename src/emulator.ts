/**
 * emulator.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { DEBUG } from "./defines"

import * as cpu from "./cpu6/cpu"
import * as memory from "./memory"
import * as tables from "./cpu6/pre_calc_tables"
import * as mmio from "./mmio"
import * as mux from "./devices/mux"
import * as diag from "./devices/diag"

export default class CenturionEmulator {
    constructor() {
        tables.makeTables()

        this.reset()
    }

    reset() {
        cpu.init_cpu()
        memory.init_memory()
        mmio.init_mmio()
        mux.init()
        diag.init()

        cpu.status.switches = 1
        diag.setSwitches(13)

        // let addr = 0x100
        // const data = memory.load_file("testflags.bin")
        // for (let i = addr; i < data.length + addr; i++)
        //     memory.ram_write_U8(i, data[i])

        // cpu.status.pc = addr
    }

    run() {
        let count = 0;

        const loop = () => {
            new Promise(function(resolve, reject) {
                resolve(1);
            }).then(function(resolve) {
                let need_delay = false
                need_delay = !cpu.step()
                // for (let i = 0; i < 1500; i++) {
                //     if (cpu.step() == false) {
                //         need_delay = true
                //         break;
                //     }
                // }

                if (need_delay) {
                    setTimeout(function () {
                        loop();
                    }, 100);
                }
                else {
                    count++;
                    if (count < 10000) {
                        loop();
                    }
                    else {   
                        count = 0;
                        // This allows other things on the JS main loop to run
                        setTimeout(function () {
                            loop();
                        }, 10);
                    }
                }
            });
        }
    
    
        loop();
    }
}

let emulator = new CenturionEmulator()

emulator.run()
