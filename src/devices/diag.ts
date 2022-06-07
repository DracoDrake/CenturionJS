
/**
 * diag.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { load_rom } from "../memory"
import { mmio_register } from "../mmio"

let switches = 0
let hexdigits = 0
let hexblank = 0
const hexdots: number[] = [0, 0, 0, 0]

export function setSwitches(sw: number) {
    switches = sw
}

export function init() {
    mmio_register(0x3F110, 0x01, read_switches, write_switches)
    mmio_register(0x3F106, 0x0F, read_hex_disp, write_hex_disp)
    load_rom("./roms/Diag_F1_Rev_1.0.BIN", 0x08000, 0x0800)
    load_rom("./roms/Diag_F2_Rev_1.0.BIN", 0x08800, 0x0800)
    load_rom("./roms/Diag_F3_Rev_1.0.BIN", 0x09000, 0x0800)
    load_rom("./roms/Diag_F4_1133CMD.BIN", 0x09800, 0x0800)
}

function read_switches(addr: number) {
    return switches
}

function write_switches(addr: number, value: number) {
    hexdigits = value
}

function read_hex_disp(addr: number) {
    return 0
}

function write_hex_disp(addr: number, value: number) {
    addr -= 0x3F106

    if (addr >= 0x2) {      
        hexdots[(addr-2) >> 1] = addr & 1
    } else {
        hexblank = addr & 1
    }

    process.stdout.write(getHexDisplay() + "\n")
}

export function getHexDisplay() {
    const hexstr = ("0" + hexdigits.toString(16)).slice(-2).toUpperCase()
    if (hexblank) {
        return "[      ]"
    }
    let out = "["
    if (hexdots[0])
        out += "*"
    else
        out += "."
    out += hexstr.charAt(0)
    if (hexdots[1])
        out += "*"
    else
        out += "."
    if (hexdots[2])
        out += "*"
    else
        out += "."
    out += hexstr.charAt(1)
    if (hexdots[3])
        out += "*"
    else
        out += "."
    out += "]"
    return out

}