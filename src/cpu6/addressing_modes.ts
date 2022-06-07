/**
 * addressing_modes.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { exit } from 'process'
import { DEBUG_fetchCapture, DEBUG_fetchCaptureAddr } from '../debug'
import { DEBUG } from '../defines'
import {
    sram_read_U8, read_I16, read_I8, read_U16, read_U8, sram_write_U8, write_I16,
    write_I8, write_U16, write_U8, sram_read_I16, sram_write_I16, sram_read_U16, sram_write_U16,
    sram_read_I8, sram_write_I8
} from '../memory'

import {
    REGB, REG, register_write_U8, register_read_I8, register_read_U8, register_read_I16,
    register_write_U16, register_read_U16, stack_push_U16
} from './common'

import { status } from './cpu'

export const AM_MODE_BYTE = 0
export const AM_MODE_WORD = 1

const addr_mode_table: Function[][] = [
    [
        addr_mode_literal_byte, addr_mode_direct, addr_mode_indirect, addr_mode_relative,
        addr_mode_relative_indirect, addr_mode_indexed_byte, addr_mode_invalid, addr_mode_invalid,
        addr_mode_A, addr_mode_B, addr_mode_X, addr_mode_Y,
        addr_mode_Z, addr_mode_S, addr_mode_C, addr_mode_P
    ],
    [
        addr_mode_literal_word, addr_mode_direct, addr_mode_indirect, addr_mode_relative,
        addr_mode_relative_indirect, addr_mode_indexed_word, addr_mode_invalid, addr_mode_invalid,
        addr_mode_A, addr_mode_B, addr_mode_X, addr_mode_Y,
        addr_mode_Z, addr_mode_S, addr_mode_C, addr_mode_P
    ],
]

export function get_address(M: number, mode: number) {
    return addr_mode_table[mode][M]()
}

function addr_mode_invalid(): number {
    console.log("Invalid Addressing Mode")
    exit(1)
}

function addr_mode_literal_byte(): number {
    const addr = status.pc
    if (DEBUG) DEBUG_fetchCaptureAddr(addr, 1)
    status.pc++
    return addr
}

function addr_mode_literal_word(): number {
    const addr = status.pc
    if (DEBUG) DEBUG_fetchCaptureAddr(addr, 2)
    status.pc += 2
    return addr
}

function addr_mode_direct(): number {
    const addr = read_U16(status.pc)
    if (DEBUG) DEBUG_fetchCapture(addr, 2)
    status.pc += 2
    return addr
}

function addr_mode_indirect(): number {
    let addr
    if (DEBUG) {
        const n = read_U16(status.pc)
        DEBUG_fetchCapture(n, 2)
        addr = read_U16(n);
    }
    else {
        addr = read_U16(read_U16(status.pc));
    }
    status.pc += 2;
    return addr;
}

export function addr_mode_relative(): number {
    let addr
    if (DEBUG) {
        const n = read_I8(status.pc)
        DEBUG_fetchCapture(n)
        addr = n + status.pc + 1
    }
    else {
        addr = read_I8(status.pc) + status.pc + 1
    }
    status.pc += 1;
    return addr;
}

function addr_mode_relative_indirect(): number {
    let addr
    if (DEBUG) {
        const n = read_I8(status.pc)
        DEBUG_fetchCapture(n)
        addr = read_U16(n + status.pc + 1)
    }
    else {
        addr = read_U16(read_I8(status.pc) + status.pc + 1)
    }
    status.pc += 1;
    return addr;
}

const indexed_mode: Function[] = [
    idx_addr_0,
    idx_addr_1,
    idx_addr_2,
    idx_addr_invalid,

    idx_addr_i_0,
    idx_addr_i_1,
    idx_addr_i_2,
    idx_addr_invalid,

    idx_addr_f_0,
    idx_addr_f_1,
    idx_addr_f_2,
    idx_addr_invalid,

    idx_addr_f_i_0,
    idx_addr_f_i_1,
    idx_addr_f_i_2,
    idx_addr_invalid
];

function addr_mode_indexed_byte(): number {
    const idx = read_U8(status.pc);
    if (DEBUG) DEBUG_fetchCapture(idx)
    status.pc += 1;
    return indexed_mode[idx & 0xf](idx >> 4, 1);
}

function addr_mode_indexed_word(): number {
    const idx = read_U8(status.pc);
    if (DEBUG) DEBUG_fetchCapture(idx)
    status.pc += 1;
    return indexed_mode[idx & 0xf](idx >> 4, 2);
}


function addr_mode_A(): number {
    return register_read_U16(REG.A);
}

function addr_mode_B(): number {
    return register_read_U16(REG.B);
}

function addr_mode_X(): number {
    return register_read_U16(REG.X);
}

function addr_mode_Y(): number {
    return register_read_U16(REG.Y);
}

function addr_mode_Z(): number {
    return register_read_U16(REG.Z);
}

function addr_mode_S(): number {
    return register_read_U16(REG.S);
}

function addr_mode_C(): number {
    return register_read_U16(REG.C);
}

function addr_mode_P(): number {
    return register_read_U16(REG.P);
}




/******** INDEXED ADDRESSING MODES ********/

function idx_addr_invalid(idx: number, size: number) {
    console.log("Index Error")
    exit(1)
}


function idx_addr_0(reg: number, size: number) {
    const addr = register_read_U16(reg);
    return addr
}


function idx_addr_1(reg: number, size: number) {
    const addr = register_read_U16(reg)
    register_write_U16(reg, addr + size)
    return addr
}


function idx_addr_2(reg: number, size: number) {
    const addr = register_read_U16(reg) - size
    register_write_U16(reg, addr)
    return addr
}


function idx_addr_i_0(reg: number, size: number) {
    const addr = register_read_U16(reg)
    return read_U16(addr)
}


function idx_addr_i_1(reg: number, size: number) {
    const addr = register_read_U16(reg)
    register_write_U16(reg, addr + size)
    return read_U16(addr)
}


function idx_addr_i_2(reg: number, size: number) {
    const addr = register_read_U16(reg) - size
    register_write_U16(reg, addr)
    return read_U16(addr)
}


function idx_addr_f_0(reg: number, size: number) {
    let addr
    const b = read_I8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = register_read_U16(reg) + b
    return addr
}


function idx_addr_f_1(reg: number, size: number) {
    let addr
    const b = read_I8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = register_read_U16(reg) 
    register_write_U16(reg, addr + size)
    return addr + b
}


function idx_addr_f_2(reg: number, size: number) {
    let addr
    const b = read_I8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = register_read_U16(reg) - size
    register_write_U16(reg, addr)
    return addr + b
}


function idx_addr_f_i_0(reg: number, size: number) {
    let addr
    const b = read_I8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = register_read_U16(reg) + b
    return read_U16(addr)
}


function idx_addr_f_i_1(reg: number, size: number) {
    let addr
    const b = read_I8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = register_read_U16(reg) 
    register_write_U16(reg, addr + size)
    return read_U16(addr + b)
}


function idx_addr_f_i_2(reg: number, size: number) {
    let addr
    const b = read_I8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = register_read_U16(reg) - size
    register_write_U16(reg, addr)
    return read_U16(addr + b)
}

