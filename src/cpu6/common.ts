
/**
 * common.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { exit } from 'process'
import { sram_read_U8, read_I16, read_I8, read_U16, read_U8, sram_write_U8, write_I16, 
    write_I8, write_U16, write_U8, sram_read_I16, sram_write_I16, sram_read_U16, sram_write_U16,
    sram_read_I8, sram_write_I8 } from '../memory'

import { status } from './cpu'

export enum REG {
    A = 0,
    AHH = 1,
    B = 2,
    BHH = 3,
    X = 4,
    XHH = 5,
    Y = 6,
    YHH = 7,
    Z = 8,
    ZHH = 9,
    S = 10,
    SHH = 11,
    C = 12,
    CHH = 13,
    P = 14,
    PHH = 15
}

export enum REGB {
    AH = 0,
    AL = 1,
    BH = 2,
    BL = 3,
    XH = 4,
    XL = 5,
    YH = 6,
    YL = 7,
    ZH = 8,
    ZL = 9,
    SH = 10,
    SL = 11,
    CH = 12,
    CL = 13,
    PH = 14,
    PL = 15
}

export function register_read_U16(reg: REG): number {
    return sram_read_U16(status.ipl << 4 | reg)
}

export function register_read_I16(reg: REG): number {
    return sram_read_I16(status.ipl << 4 | reg)
}

export function register_read_U8(reg: REGB): number {
    return sram_read_U8(status.ipl << 4 | reg)
}

export function register_read_I8(reg: REGB): number {
    return sram_read_I8(status.ipl << 4 | reg)
}


export function register_write_U16(reg: REG, value: number) {
    sram_write_U16(status.ipl << 4 | reg, value)
}

export function register_write_I16(reg: REG, value: number) {
    sram_write_I16(status.ipl << 4 | reg, value)
}

export function register_write_U8(reg: REGB, value: number) {
    sram_write_U8(status.ipl << 4 | reg, value)
}

export function register_write_I8(reg: REGB, value: number) {
    sram_write_I8(status.ipl << 4 | reg, value)
}


export function stack_push_U16(value: number) {
	let addr = register_read_U16(REG.S)
	addr -= 2
	write_U16(addr, value)
	register_write_U16(REG.S, addr)
}

export function stack_pop_U16() {
    let addr = register_read_U16(REG.S)
	let ret = read_U16(addr)
	addr += 2
	register_write_U16(REG.S, addr)
	return ret
}

export function stack_push_U8(value: number) {
	let addr = register_read_U16(REG.S)
	addr -= 1
	write_U8(addr, value)
	register_write_U16(REG.S, addr)
}

export function stack_pop_U8() {
    let addr = register_read_U16(REG.S)
	let ret = read_U8(addr)
	addr += 1
	register_write_U16(REG.S, addr)
	return ret
}