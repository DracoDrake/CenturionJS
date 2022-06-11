/**
 * Emulator.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { DEBUG } from "./Defines"

import * as tables from "./cards/CPU6/PreCalcTables"
import MuxCard, * as mux from "./cards/MuxCard"
import DiagnosticCard, * as diag from "./cards/DiagnosticCard"
import Card from "./Card"
import Machine from "./Machine"
import { MeasureMemoryMode } from "vm"
import RamCard from "./cards/RamCard"
import CPU6Card from "./cards/CPU6Card"
import { DEBUG_PrintHexDump } from "./Debug"

export default class CenturionEmulator {
    machine: Machine
    count: number = 0
    in_q: number[] = []
    mux1: MuxCard
    ram1: RamCard
    ram2: RamCard
    diag: DiagnosticCard
    cpu: CPU6Card

    constructor() {
        tables.makeTables()

        this.machine = new Machine()

        // Add CPU6 Card
        this.cpu = new CPU6Card({
        })
        this.machine.addCard(this.cpu, 1)

        // Add Mux Card
        this.mux1 = new MuxCard({
            start_address: 0x3F200,
            read_callback: this.mux_read.bind(this),
            write_callback: this.mux_write.bind(this),
            set_port_settings: this.mux_set_port_settings
        })
        this.machine.addCard(this.mux1, 4)

        // Add Diagnostic Card
        this.diag = new DiagnosticCard({
            displayCallback: this.updateHexDisplay
        })
        this.machine.addCard(this.diag, 5)

        // Add Ram Card 1
        this.ram1 = new RamCard({
            start_address: 0x0,
            size: 0x20000
        })
        this.machine.addCard(this.ram1, 6)

        // Add Ram Card 2
        this.ram2 = new RamCard({
            start_address: 0x20000,
            size: 0x20000
        })
        this.machine.addCard(this.ram2, 7)


        // Setup input
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.on('readable', () => {
            const in_buf = process.stdin.read(1)
            if (in_buf !== null) {
                if (in_buf[0] == 0x1a) {
                    process.exit(2)
                }
                this.in_q.push(in_buf[0])
                this.mux1.setCanRead(0, true)
            }
        });

        this.reset()
    }

    mux_read(port: number): number {
        if (port == 0) {
            const ch = this.in_q.pop()
            
            if (this.in_q.length == 0) {
                this.mux1.setCanRead(0, false)
            }
            if (ch === undefined) {
                this.mux1.setCanRead(0, false)
                return 0xFF
            }

            return ch
        }
        return 0xFF
    }

    mux_write(port: number, value: number): void {
        if (port == 0) {
            process.stdout.write(String.fromCharCode(value))
        }
    }

    mux_set_port_settings(port: number, baud: number, data_bits: number, stop_bits: number, parity: mux.MuxParity): void {
        console.log(`Setting MUX Settings to ${baud}, ${data_bits}, ${parity}, ${stop_bits}`)
    }

    updateHexDisplay(upper_digit: number, lower_digit: number, upper_dots: boolean[], lower_dots: boolean[], is_blank: boolean) {
        if (is_blank) {
            return "[      ]"
        }
        let out = "["
        if (upper_dots[0])
            out += "*"
        else
            out += "."
        out += upper_digit.toString(16).toUpperCase()
        if (upper_dots[1])
            out += "*"
        else
            out += "."
        if (lower_dots[0])
            out += "*"
        else
            out += "."
        out += lower_digit.toString(16).toUpperCase()
        if (lower_dots[1])
            out += "*"
        else
            out += "."
        out += "]"

        process.stdout.write(out + "\n")
    }

    reset() {
        this.machine.reset()

        this.cpu.setSwitches(1)
        this.diag.setSwitches(13)

        // this.in_q = [0x0a, 0x32, 0x30] //[0x0A, 0x32, 0x30]
        // this.mux1.setCanRead(0, true)
    }

    run() {
        new Promise(function(resolve, reject) {
            resolve(1);
        }).then(() => {
            this.process()
        });
    }

    process() {
        let need_delay = false
        need_delay = !this.cpu.step()
        // for (let i = 0; i < 1500; i++) {
        //     if (cpu.step() == false) {
        //         need_delay = true
        //         break;
        //     }
        // }

        if (need_delay) {
            setTimeout(() => this.run(), 100);
        }
        else {
            this.count++;
            if (this.count < 10000) {
                this.run()
            }
            else {   
                this.count = 0
                // This allows other things on the JS main loop to run
                setTimeout(() => this.run(), 0)
            }
        }
    }
}

let emulator = new CenturionEmulator()

// for(const reservation of emulator.machine.addressReservations) {
//     console.log(`start:${reservation.start_addr.toString(16)}, end:${reservation.end_addr.toString(16)}, card:${reservation.card}`)
// }

emulator.run()