/**
 * debug.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { DEBUG } from "./defines"
import { FLAG_FAULT, FLAG_LINK, FLAG_MINUS, FLAG_VALUE, status } from "./cpu6/cpu"
import { read_I8, read_U16, read_U8, sram_read_U16, sram_read_U8 } from "./memory"
import { REG, REGB } from "./cpu6/common"
import { sprintf } from "sprintf-js"

let instr = ""
let fetch_bytes: number[] = []
let pc = 0

const branch_names: string[] = [
    "BL", "BNL", "BF", "BNF", "BZ", "BNZ", "BM", "BP", "BGZ", "BLE", "BS1", "BS2", "BS3", "BS4", "BTM", "BEP"
]

export function DEBUG_Print(msg: string, ...param: any) {
    if (DEBUG) {
        process.stderr.write(sprintf(msg, ...param))
    }
}
export function DEBUG_PrintOp() {
    if (DEBUG) {
        // process.stderr.write(sprintf("%04X:%s \t\t%s\n", pc, DEBUG_getFetchedBytes(), instr))
        process.stderr.write(sprintf("%s %s\n", DEBUG_getFetchedBytes(), instr))
    }
}

export function DEBUG_clear() {
    fetch_bytes = []
    instr = ""
}

export function DEBUG_captureInstr(msg: string, ...param: any) {
    if (DEBUG) {
        if (instr == "") {
            instr = sprintf(msg, ...param)
        }
    }
}

export function DEBUG_captureInstrBranch(M: number, rel: number) {
    DEBUG_captureInstr("%s PC%+d =%04X", branch_names[M], rel, rel + status.pc)
}

export function DEBUG_fetchCapture(num: number, size: number = 1) {
    if (size == 1) {
        fetch_bytes.push(num & 0xFF)
    }
    else if (size == 2) {
        fetch_bytes.push(num >> 8)
        fetch_bytes.push(num & 0xFF)
    }
}


export function DEBUG_getFetchedBytes() {
    if (DEBUG) {
        let hex_bytes = fetch_bytes.map(value => {
            return sprintf("%02X", value)
        })

        return hex_bytes.join(" ")
    }
}

export function DEBUG_fetchCapturePC(a: number) {
    pc = a
}

export function DEBUG_fetchCaptureAddr(addr: number, size: number) {
    if (size == 1) {
        DEBUG_fetchCapture(read_U8(addr), 1)
    }
    else if (size == 2) {
        DEBUG_fetchCapture(read_U16(addr), 2)
    }
}

function DEBUG_register_read_U8(reg: REGB): number {
    return sram_read_U8(status.ipl << 4 | reg)
}

function DEBUG_register_read_U16(reg: REG): number {
    return sram_read_U16(status.ipl << 4 | reg)
}

export function DEBUG_PrintRegisters() {
    if (DEBUG) {
        // let flags = ""
        // if (status.flags & FLAG_VALUE) flags += 'V'; else flags += '-'
        // if (status.flags & FLAG_FAULT) flags += 'F'; else flags += '-'
        // if (status.flags & FLAG_MINUS) flags += 'M'; else flags += '-'
        // if (status.flags & FLAG_LINK) flags += 'L'; else flags += '-'

        // process.stderr.write(sprintf("[%s] (ipl=%d): A=%04X, B=%04X, X=%04X, Y=%04X, Z=%04X, S=%04X, C=%04X, P=%04X ",
        //     flags,
        //     status.ipl,    
        //     DEBUG_register_read_U16(REG.A),
        //     DEBUG_register_read_U16(REG.B),
        //     DEBUG_register_read_U16(REG.X),
        //     DEBUG_register_read_U16(REG.Y),
        //     DEBUG_register_read_U16(REG.Z),
        //     DEBUG_register_read_U16(REG.S),
        //     DEBUG_register_read_U16(REG.C),
        //     DEBUG_register_read_U16(REG.P)
        // ))

        let flags = ""
        if (status.flags & FLAG_FAULT) flags += 'F'; else flags += '-'
        flags += '-'
        if (status.flags & FLAG_LINK) flags += 'L'; else flags += '-'
        if (status.flags & FLAG_MINUS) flags += 'M'; else flags += '-'
        if (status.flags & FLAG_VALUE) flags += 'V'; else flags += '-'

        process.stderr.write(sprintf("CPU %04X: %02X %s A:%04X  B:%04X X:%04X Y:%04X Z:%04X S:%04X C:%04X |",
            pc,
            fetch_bytes[0],
            flags,
            DEBUG_register_read_U16(REG.A),
            DEBUG_register_read_U16(REG.B),
            DEBUG_register_read_U16(REG.X),
            DEBUG_register_read_U16(REG.Y),
            DEBUG_register_read_U16(REG.Z),
            DEBUG_register_read_U16(REG.S),
            DEBUG_register_read_U16(REG.C)
        ))
    }
}

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


export function DEBUG_captureInstrWithAM(name: string, M: number, mode: number) {
    const str = addr_mode_table[mode][M](name)
    DEBUG_captureInstr(str)
}


function addr_mode_invalid(name: string): string {
    if (DEBUG) {
        return sprintf("%s [Invalid Addressing Mode]", name)
    }
    return ""
}

function addr_mode_literal_byte(name: string): string {
    if (DEBUG) {
        return sprintf("%s =%02X", name, read_U8(status.pc))
    }
    return ""
}

function addr_mode_literal_word(name: string): string {
    if (DEBUG) {
        return sprintf("%s =%04X", name, read_U16(status.pc))
    }
    return ""
}

function addr_mode_direct(name: string): string {
    if (DEBUG) {
        return sprintf("%s %04X", name, read_U16(status.pc))
    }
    return ""
}

function addr_mode_indirect(name: string): string {
    if (DEBUG) {
        return sprintf("%s (%04X)", name, read_U16(status.pc))
    }
    return ""
}

export function addr_mode_relative(name: string): string {
    if (DEBUG) {
        const rel = read_I8(status.pc)
        return sprintf("%s PC%+d =%04X", name, rel, rel + status.pc + 1)
    }
    return ""
}

function addr_mode_relative_indirect(name: string): string {
    if (DEBUG) {
        const rel = read_I8(status.pc)
        return sprintf("%s (PC%+d) =%04X", name, rel, rel + status.pc + 1)
    }
    return ""
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

function addr_mode_indexed_byte(name: string): string {
    if (DEBUG) {
        const idx = read_U8(status.pc)
        return sprintf("%s %s", name, indexed_mode[idx & 0xf](idx >> 4, 1))
    }
    return ""
}

function addr_mode_indexed_word(name: string): string {
    if (DEBUG) {
        const idx = read_U8(status.pc)
        return sprintf("%s %s", name, indexed_mode[idx & 0xf](idx >> 4, 2))
    }
    return ""
}


function addr_mode_A(name: string): string {
    if (DEBUG) {
        return sprintf("%s (A)", name)
    }
    return ""
}

function addr_mode_B(name: string): string {
    if (DEBUG) {
        return sprintf("%s (B)", name)
    }
    return ""
}

function addr_mode_X(name: string): string {
    if (DEBUG) {
        return sprintf("%s (X)", name)
    }
    return ""
}

function addr_mode_Y(name: string): string {
    if (DEBUG) {
        return sprintf("%s (Y)", name)
    }
    return ""
}

function addr_mode_Z(name: string): string {
    if (DEBUG) {
        return sprintf("%s (Z)", name)
    }
    return ""
}

function addr_mode_S(name: string): string {
    if (DEBUG) {
        return sprintf("%s (S)", name)
    }
    return ""
}

function addr_mode_C(name: string): string {
    if (DEBUG) {
        return sprintf("%s (C)", name)
    }
    return ""
}

function addr_mode_P(name: string): string {
    if (DEBUG) {
        return sprintf("%s (P)", name)
    }
    return ""
}



/******** INDEXED ADDRESSING MODES ********/

function idx_addr_invalid(idx: number, size: number) {
    return "Invalid Index Addressing Mode"
}


function idx_addr_0(reg: number, size: number) {
    if (DEBUG) {
        return sprintf("(%s)", REG[reg])
    }
}


function idx_addr_1(reg: number, size: number) {
    if (DEBUG) {
        return sprintf("(%s+)", REG[reg])
    }
}


function idx_addr_2(reg: number, size: number) {
    if (DEBUG) {
        return sprintf("(-%s)", REG[reg])
    }
}


function idx_addr_i_0(reg: number, size: number) {
    if (DEBUG) {
        return sprintf("@(%s)", REG[reg])
    }
}


function idx_addr_i_1(reg: number, size: number) {
    if (DEBUG) {
        return sprintf("@(%s+)", REG[reg])
    }
}


function idx_addr_i_2(reg: number, size: number) {
    if (DEBUG) {
        return sprintf("@(-%s)", REG[reg])
    }
}


function idx_addr_f_0(reg: number, size: number) {
    if (DEBUG) {
        let b = read_I8(status.pc+1)
        return sprintf("(%s)%+d", REG[reg], b)
    }
}


function idx_addr_f_1(reg: number, size: number) {
    if (DEBUG) {
        let b = read_I8(status.pc+1)
        return sprintf("(%s+)%+d", REG[reg], b)
    }
}


function idx_addr_f_2(reg: number, size: number) {
    if (DEBUG) {
        let b = read_I8(status.pc+1)
        return sprintf("(-%s)%+d", REG[reg], b)
    }
}


function idx_addr_f_i_0(reg: number, size: number) {
    if (DEBUG) {
        let b = read_I8(status.pc+1)
        return sprintf("@(%s)%+d", REG[reg], b)
    }
}


function idx_addr_f_i_1(reg: number, size: number) {
    if (DEBUG) {
        let b = read_I8(status.pc+1)
        return sprintf("@(%s+)%+d", REG[reg], b)
    }
}


function idx_addr_f_i_2(reg: number, size: number) {
    if (DEBUG) {
        let b = read_I8(status.pc+1)
        return sprintf("@(-%s)%+d", REG[reg], b)
    }
}

