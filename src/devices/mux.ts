
/**
 * mux.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { opcount, status, triggerInterrupt } from "../cpu6/cpu";
import { DEBUG_Print } from "../debug";
import { mmio_register } from "../mmio"

let enable_interrupts = false
let interrupt_level = 0
let interrupt_flags = 0

let muxconf: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const in_q: number[] = [] //[0x0a, 0x31, 0x30] //[0x0A, 0x32, 0x30]

export function init() {
    mmio_register(0x3F200, 0x20, read, write)
    process.stdin.setRawMode(true);
    process.stdin.on('readable', function () {
        const in_buf = process.stdin.read(1)
        if (in_buf !== null) {
            if (in_buf[0] == 0x1a) {
                process.exit(2)
            }
            in_q.push(in_buf[0])
            if (enable_interrupts) {
                interrupt_flags = 0
                triggerInterrupt(interrupt_level)
            }
            // count = 0
            // time = 0
        }
    });
}

function write(addr: number, value: number) {
    //DEBUG_Print("MUX: %05X %02X\n", addr, value)
    if (addr == 0x3F20E) {
        enable_interrupts = true
        return
    }

    if (addr == 0x3F20A) {
        interrupt_level = value
        DEBUG_Print("MUX Interrupt set to %d\n", interrupt_level)
        return
    }
    
    const mux = (addr >> 1) & 0x0F
    const data = addr & 1

    if (!data) {
        muxconf[mux] = value;
        return;
    }

    if (mux != 0)
        return;

    value &= 0x7F;
    //const _global = (window /* browser */ || global /* node */) as any
    emu_write(value);
}



function read(addr: number): number {
    if (addr == 0x3F20F) {
        return interrupt_flags
    }
    //const ctrl = 0;

    const mux = (addr >> 1) & 0xFF
    const data = addr & 1

    if (mux != 0)
        return 0

    // const _global = (window /* browser */ || global /* node */) as any
    return emu_read(data) & 0xff
}


process.on('SIGINT', () => {
    in_q.push(0x03)
});

function emu_read(data: number): number {
    if (data == 1) {
        const ch = in_q.pop();
        if (ch === undefined)
            return 0xFF
        return ch
    }
    else {
        let status = 0
        if (in_q.length > 0)
            status |= 1         // can read
        status |= 2             // can write

        // status |= 4          // parity error?
        return status
    }
}

function emu_write(val: number): void {
    process.stdout.write(String.fromCharCode(val))
}
