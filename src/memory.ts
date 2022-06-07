/**
 * memory.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import fs from 'fs'
import { status } from './cpu6/cpu'
import { DEBUG_Print } from './debug'
import { DEBUG } from './defines'
import { mmio_read_I16, mmio_read_I8, mmio_read_U16, mmio_read_U8, mmio_write_I16, mmio_write_I8, mmio_write_U16, mmio_write_U8 } from './mmio'

const ram_buffer: ArrayBuffer = new ArrayBuffer(0x80000) // 19 bit address
const sram_buffer: ArrayBuffer = new ArrayBuffer(0x100)
const ram = new DataView(ram_buffer)
const sram = new DataView(sram_buffer)

const U8 = 0
const I8 = 1
const U16 = 2
const I16 = 3

const READ = 0
const WRITE = 1

const map: Function[][][] = []

export const mmu: number[] = []

function rom_write_attempted(addr: number, value: number) {
    throw Error(`Attempted write to ROM at 0x${addr.toString(16)}, value 0x${value.toString(16)}`)
}


// SRAM read

export function sram_read_U8(addr: number): number {
    if (DEBUG) {

    }
    return sram.getUint8(addr)
}

export function sram_read_I8(addr: number): number {
    return sram.getInt8(addr)
}

export function sram_read_U16(addr: number): number {
    if (addr & 1)
        return sram.getUint8(addr & 0xFE) << 8 | sram.getUint8(addr & 0xFE)
    return sram.getUint16(addr, false)
}

export function sram_read_I16(addr: number): number {
    if (addr & 1)
        return sram.getInt8(addr & 0xFE) << 8 | sram.getUint8(addr & 0xFE)
    return sram.getInt16(addr, false)
}


// SRAM write

export function sram_write_U8(addr: number, value: number) {
    //if (DEBUG) DEBUG_Print("sram_write_U8(%04X, %02X)", addr, value)
    sram.setUint8(addr, value)
}

export function sram_write_I8(addr: number, value: number) {
    sram.setInt8(addr, value)
}

export function sram_write_U16(addr: number, value: number) {
    if (addr & 1) {
        sram.setUint8(addr & 0xFE, value >> 8)
        sram.setUint8(addr ^ 1, value)
    }
    else {
        sram.setUint16(addr, value, false)
    }
}

export function sram_write_I16(addr: number, value: number) {
    if (addr & 1) {
        sram.setUint8(addr & 0xFE, value >> 8)
        sram.setUint8(addr ^ 1, value)
    }
    else {
        sram.setInt16(addr, value, false)
    }
}




// Main RAM/ROM read

export function ram_read_U8(addr: number): number {
    return ram.getUint8(addr)
}

export function ram_read_I8(addr: number): number {
    return ram.getInt8(addr)
}

export function ram_read_U16(addr: number): number {
    return ram.getUint16(addr, false)
}

export function ram_read_I16(addr: number): number {
    return ram.getUint16(addr, false)
}



// Main RAM write

export function ram_write_U8(addr: number, value: number) {
    ram.setUint8(addr, value)
}

export function ram_write_I8(addr: number, value: number) {
    ram.setInt8(addr, value)
}

export function ram_write_U16(addr: number, value: number) {
    ram.setUint16(addr, value, false)
}

export function ram_write_I16(addr: number, value: number) {
    ram.setInt16(addr, value, false)
}



export function read_U8(addr: number): number {
    addr = mmu[addr >> 11 | status.ipl << 5] << 11 | addr & 0x07FF
    return map[addr >> 8][READ][U8](addr)
}

export function read_I8(addr: number): number {
    addr = mmu[addr >> 11 | status.ipl << 5] << 11 | addr & 0x07FF
    return map[addr >> 8][READ][I8](addr)
}

export function read_U16(addr: number): number {
    addr = mmu[addr >> 11 | status.ipl << 5] << 11 | addr & 0x07FF
    return map[addr >> 8][READ][U16](addr)
}

export function read_I16(addr: number) {
    addr = mmu[addr >> 11 | status.ipl << 5] << 11 | addr & 0x07FF
    return map[addr >> 8][READ][I16](addr)
}

export function write_U8(addr: number, value: number) {
    addr = mmu[addr >> 11 | status.ipl << 5] << 11 | addr & 0x07FF
    map[addr >> 8][WRITE][U8](addr, value)
}

export function write_I8(addr: number, value: number) {
    addr = mmu[addr >> 11 | status.ipl << 5] << 11 | addr & 0x07FF
    map[addr >> 8][WRITE][I8](addr, value)
}

export function write_U16(addr: number, value: number) {
    addr = mmu[addr >> 11 | status.ipl << 5] << 11 | addr & 0x07FF
    map[addr >> 8][WRITE][U16](addr, value)
}

export function write_I16(addr: number, value: number) {
    addr = mmu[addr >> 11 | status.ipl << 5] << 11 | addr & 0x07FF
    map[addr >> 8][WRITE][I16](addr, value)
}


function mark_memory_SRAM(addr: number, len: number) {
    const block_start = addr >> 8
    const block_end = (len >> 8) + block_start

    for(let block = block_start; block < block_end; block++) {
        map[block] = []
        map[block][READ] = []
        map[block][READ][U8] = sram_read_U8
        map[block][READ][I8] = sram_read_I8
        map[block][READ][U16] = sram_read_U16
        map[block][READ][I16] = sram_read_I16
        map[block][WRITE] = []
        map[block][WRITE][U8] = sram_write_U8
        map[block][WRITE][I8] = sram_write_I8
        map[block][WRITE][U16] = sram_write_U16
        map[block][WRITE][I16] = sram_write_I16
    }
}

function mark_memory_ROM(addr: number, len: number) {
    const block_start = addr >> 8
    const block_end = (len >> 8) + block_start + 1

    for(let block = block_start; block < block_end; block++) {
        map[block] = []
        map[block][READ] = []
        map[block][READ][U8] = ram_read_U8
        map[block][READ][I8] = ram_read_I8
        map[block][READ][U16] = ram_read_U16
        map[block][READ][I16] = ram_read_I16
        map[block][WRITE] = []
        map[block][WRITE][U8] = rom_write_attempted
        map[block][WRITE][I8] = rom_write_attempted
        map[block][WRITE][U16] = rom_write_attempted
        map[block][WRITE][I16] = rom_write_attempted
    }
}

function mark_memory_RAM(addr: number, len: number) {
    const block_start = addr >> 8
    const block_end = (len >> 8) + block_start + 1

    for(let block = block_start; block < block_end; block++) {
        map[block] = []
        map[block][READ] = []
        map[block][READ][U8] = ram_read_U8
        map[block][READ][I8] = ram_read_I8
        map[block][READ][U16] = ram_read_U16
        map[block][READ][I16] = ram_read_I16
        map[block][WRITE] = []
        map[block][WRITE][U8] = ram_write_U8
        map[block][WRITE][I8] = ram_write_I8
        map[block][WRITE][U16] = ram_write_U16
        map[block][WRITE][I16] = ram_write_I16
    }
}

export function mark_memory_MMIO(addr: number, len: number) {
    const block_start = addr >> 8
    const block_end = (len >> 8) + block_start + 1

    for(let block = block_start; block < block_end; block++) {
        map[block] = []
        map[block][READ] = []
        map[block][READ][U8] = mmio_read_U8
        map[block][READ][I8] = mmio_read_I8
        map[block][READ][U16] = mmio_read_U16
        map[block][READ][I16] = mmio_read_I16
        map[block][WRITE] = []
        map[block][WRITE][U8] = mmio_write_U8
        map[block][WRITE][I8] = mmio_write_I8
        map[block][WRITE][U16] = mmio_write_U16
        map[block][WRITE][I16] = mmio_write_I16
    }
}

export function init_memory() {
    mark_memory_RAM(0x0, 0x80000)
    mark_memory_SRAM(0x0, 0x100)

    load_rom("./roms/bootstrap_unscrambled.bin", 0x3FC00, 0x0200)

    // init mmu
    for(let j=0; j<8; j++) {
        for(let i=0; i<30; i++) {
            mmu[i+j*32] = i
        }
        mmu[30+j*32] = 0x7e
        mmu[31+j*32] = 0x7f
    }
}


export function load_file(file: string): Uint8Array {
    var buffer = fs.readFileSync(file);
    return new Uint8Array(buffer)
}

export function load_rom(file: string, addr: number, len: number) {
    const data = load_file(file)

    if (data.length >= len) {
        for (let i = 0; i < len; i++)
            ram.setUint8(i + addr, data[i]);
    }
    else {
        throw Error("Trying to load more data than avaliable")
    }

    mark_memory_ROM(addr, len)
}
