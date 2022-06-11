/**
 * AddressingModes.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { exit } from 'process'
import { DEBUG_fetchCapture, DEBUG_fetchCaptureAddr } from '../../Debug'
import { DEBUG } from '../../Defines'
import CPU6Card, {
    REGB, REG
} from '../CPU6Card'

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

export function get_address(cpu: CPU6Card, M: number, mode: number) {
    return addr_mode_table[mode][M](cpu)
}

function addr_mode_invalid(cpu: CPU6Card): number {
    console.log("Invalid Addressing Mode")
    exit(1)
}

function addr_mode_literal_byte(cpu: CPU6Card): number {
    const addr = cpu.status.pc
    if (DEBUG) DEBUG_fetchCaptureAddr(cpu, addr, 1)
    cpu.status.pc++
    return addr
}

function addr_mode_literal_word(cpu: CPU6Card): number {
    const addr = cpu.status.pc
    if (DEBUG) DEBUG_fetchCaptureAddr(cpu, addr, 2)
    cpu.status.pc += 2
    return addr
}

function addr_mode_direct(cpu: CPU6Card): number {
    const addr = cpu.read_U16(cpu.status.pc)
    if (DEBUG) DEBUG_fetchCapture(addr, 2)
    cpu.status.pc += 2
    return addr
}

function addr_mode_indirect(cpu: CPU6Card): number {
    let addr
    if (DEBUG) {
        const n = cpu.read_U16(cpu.status.pc)
        DEBUG_fetchCapture(n, 2)
        addr = cpu.read_U16(n);
    }
    else {
        addr = cpu.read_U16(cpu.read_U16(cpu.status.pc));
    }
    cpu.status.pc += 2;
    return addr;
}

export function addr_mode_relative(cpu: CPU6Card): number {
    let addr
    if (DEBUG) {
        const n = cpu.read_I8(cpu.status.pc)
        DEBUG_fetchCapture(n)
        addr = n + cpu.status.pc + 1
    }
    else {
        addr = cpu.read_I8(cpu.status.pc) + cpu.status.pc + 1
    }
    cpu.status.pc += 1;
    return addr;
}

function addr_mode_relative_indirect(cpu: CPU6Card): number {
    let addr
    if (DEBUG) {
        const n = cpu.read_I8(cpu.status.pc)
        DEBUG_fetchCapture(n)
        addr = cpu.read_U16(n + cpu.status.pc + 1)
    }
    else {
        addr = cpu.read_U16(cpu.read_I8(cpu.status.pc) + cpu.status.pc + 1)
    }
    cpu.status.pc += 1;
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

function addr_mode_indexed_byte(cpu: CPU6Card): number {
    const idx = cpu.read_U8(cpu.status.pc);
    if (DEBUG) DEBUG_fetchCapture(idx)
    cpu.status.pc += 1;
    return indexed_mode[idx & 0xf](cpu, idx >> 4, 1);
}

function addr_mode_indexed_word(cpu: CPU6Card): number {
    const idx = cpu.read_U8(cpu.status.pc);
    if (DEBUG) DEBUG_fetchCapture(idx)
    cpu.status.pc += 1;
    return indexed_mode[idx & 0xf](cpu, idx >> 4, 2);
}


function addr_mode_A(cpu: CPU6Card): number {
    return cpu.register_read_U16(REG.A);
}

function addr_mode_B(cpu: CPU6Card): number {
    return cpu.register_read_U16(REG.B);
}

function addr_mode_X(cpu: CPU6Card): number {
    return cpu.register_read_U16(REG.X);
}

function addr_mode_Y(cpu: CPU6Card): number {
    return cpu.register_read_U16(REG.Y);
}

function addr_mode_Z(cpu: CPU6Card): number {
    return cpu.register_read_U16(REG.Z);
}

function addr_mode_S(cpu: CPU6Card): number {
    return cpu.register_read_U16(REG.S);
}

function addr_mode_C(cpu: CPU6Card): number {
    return cpu.register_read_U16(REG.C);
}

function addr_mode_P(cpu: CPU6Card): number {
    return cpu.register_read_U16(REG.P);
}




/******** INDEXED ADDRESSING MODES ********/

function idx_addr_invalid(cpu: CPU6Card, idx: number, size: number) {
    console.log("Index Error")
    exit(1)
}


function idx_addr_0(cpu: CPU6Card, reg: number, size: number) {
    const addr = cpu.register_read_U16(reg);
    return addr
}


function idx_addr_1(cpu: CPU6Card, reg: number, size: number) {
    const addr = cpu.register_read_U16(reg)
    cpu.register_write_U16(reg, addr + size)
    return addr
}


function idx_addr_2(cpu: CPU6Card, reg: number, size: number) {
    const addr = cpu.register_read_U16(reg) - size
    cpu.register_write_U16(reg, addr)
    return addr
}


function idx_addr_i_0(cpu: CPU6Card, reg: number, size: number) {
    const addr = cpu.register_read_U16(reg)
    return cpu.read_U16(addr)
}


function idx_addr_i_1(cpu: CPU6Card, reg: number, size: number) {
    const addr = cpu.register_read_U16(reg)
    cpu.register_write_U16(reg, addr + size)
    return cpu.read_U16(addr)
}


function idx_addr_i_2(cpu: CPU6Card, reg: number, size: number) {
    const addr = cpu.register_read_U16(reg) - size
    cpu.register_write_U16(reg, addr)
    return cpu.read_U16(addr)
}


function idx_addr_f_0(cpu: CPU6Card, reg: number, size: number) {
    let addr
    const b = cpu.read_I8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = cpu.register_read_U16(reg) + b
    return addr
}


function idx_addr_f_1(cpu: CPU6Card, reg: number, size: number) {
    let addr
    const b = cpu.read_I8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = cpu.register_read_U16(reg) 
    cpu.register_write_U16(reg, addr + size)
    return addr + b
}


function idx_addr_f_2(cpu: CPU6Card, reg: number, size: number) {
    let addr
    const b = cpu.read_I8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = cpu.register_read_U16(reg) - size
    cpu.register_write_U16(reg, addr)
    return addr + b
}


function idx_addr_f_i_0(cpu: CPU6Card, reg: number, size: number) {
    let addr
    const b = cpu.read_I8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = cpu.register_read_U16(reg) + b
    return cpu.read_U16(addr)
}


function idx_addr_f_i_1(cpu: CPU6Card, reg: number, size: number) {
    let addr
    const b = cpu.read_I8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = cpu.register_read_U16(reg) 
    cpu.register_write_U16(reg, addr + size)
    return cpu.read_U16(addr + b)
}


function idx_addr_f_i_2(cpu: CPU6Card, reg: number, size: number) {
    let addr
    const b = cpu.read_I8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(b)
    addr = cpu.register_read_U16(reg) - size
    cpu.register_write_U16(reg, addr)
    return cpu.read_U16(addr + b)
}

