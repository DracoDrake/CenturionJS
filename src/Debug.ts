/**
 * Debug.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { DEBUG } from "./Defines"
import { FLAG_FAULT, FLAG_LINK, FLAG_MINUS, FLAG_VALUE } from "./cards/CPU6/CPU6"
import CPU6Card, { REG, REGB } from "./cards/CPU6Card"
import { sprintf } from "sprintf-js"

let instr = ""
let fetch_bytes: number[] = []
let pc = 0

const branch_names: string[] = [
    "BL", "BNL", "BF", "BNF", "BZ", "BNZ", "BM", "BP", "BGZ", "BLE", "BS1", "BS2", "BS3", "BS4", "BTM", "BEP"
]

export function DEBUG_PrintHexDump(data: number[] | Uint8Array, len: number, start?: number, end?: number) {
    let linedata = []

    if (data instanceof Uint8Array) {
        data = Array.from(data)
    }

    if (start === undefined) {
        start = 0
    }
    if (end === undefined) {
        end = len
    }

    let buf_end = -start
    let buf_start = buf_end-16

    while(buf_end+start < end) {
        buf_start = buf_end
        buf_end = buf_end+16

        if (buf_end > len) {
            buf_end = len
        }

        if (buf_end >= 0) {
            const line_start = buf_start+start
            const line_end = buf_end+start

            const bytes = data.slice(line_start, line_end)
            let str_bytes: string[] = []
            let chars: string[] = []

            for(let i=line_start; i<line_end; i++) {
                if (i >= start && i < end) {
                    str_bytes.push(sprintf("%02X", data[i]))
                
                    if (data[i] < 32 || data[i] >= 127)
                        chars.push(".")
                    else
                        chars.push(String.fromCharCode(data[i]))
                }
                else {
                    str_bytes.push("..")
                    chars.push(" ")
                }

            }

            DEBUG_Print("%04X: %s  %s\n", line_start, str_bytes.join(" "), chars.join(""))
        }

    }
}

// let data = []
// for(let i=0; i<256; i++)
//     data.push(i)

// DEBUG_PrintHexDump(data, 256)

export function DEBUG_PrintMMU(cpu: CPU6Card) {
    DEBUG_Print("Current MMU Bytes:\n")
    DEBUG_PrintHexDump(cpu.mmu, 256)
}

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

export function DEBUG_captureInstrBranch(cpu: CPU6Card, M: number, rel: number) {
    DEBUG_captureInstr("%s PC%+d =%04X", branch_names[M], rel, rel + cpu.status.pc)
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

export function DEBUG_fetchCaptureAddr(cpu: CPU6Card, addr: number, size: number) {
    if (size == 1) {
        DEBUG_fetchCapture(cpu.read_U8(addr), 1)
    }
    else if (size == 2) {
        DEBUG_fetchCapture(cpu.read_U16(addr), 2)
    }
}

function DEBUG_register_read_U8(cpu: CPU6Card, reg: REGB): number {
    return cpu.sram_read_U8(cpu.status.ipl << 4 | reg)
}

function DEBUG_register_read_U16(cpu: CPU6Card, reg: REG): number {
    return cpu.sram_read_U16(cpu.status.ipl << 4 | reg)
}

export function DEBUG_PrintRegisters(cpu: CPU6Card) {
    if (DEBUG) {
        // let flags = ""
        // if (cpu.status.flags & FLAG_VALUE) flags += 'V'; else flags += '-'
        // if (cpu.status.flags & FLAG_FAULT) flags += 'F'; else flags += '-'
        // if (cpu.status.flags & FLAG_MINUS) flags += 'M'; else flags += '-'
        // if (cpu.status.flags & FLAG_LINK) flags += 'L'; else flags += '-'

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
        if (cpu.status.flags & FLAG_FAULT) flags += 'F'; else flags += '-'
        flags += '-'
        if (cpu.status.flags & FLAG_LINK) flags += 'L'; else flags += '-'
        if (cpu.status.flags & FLAG_MINUS) flags += 'M'; else flags += '-'
        if (cpu.status.flags & FLAG_VALUE) flags += 'V'; else flags += '-'

        process.stderr.write(sprintf("CPU %04X: %02X %s A:%04X  B:%04X X:%04X Y:%04X Z:%04X S:%04X C:%04X |",
            pc,
            fetch_bytes[0],
            flags,
            DEBUG_register_read_U16(cpu, REG.A),
            DEBUG_register_read_U16(cpu, REG.B),
            DEBUG_register_read_U16(cpu, REG.X),
            DEBUG_register_read_U16(cpu, REG.Y),
            DEBUG_register_read_U16(cpu, REG.Z),
            DEBUG_register_read_U16(cpu, REG.S),
            DEBUG_register_read_U16(cpu, REG.C)
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


export function DEBUG_captureInstrWithAM(cpu: CPU6Card, name: string, M: number, mode: number) {
    const str = addr_mode_table[mode][M](cpu, name)
    DEBUG_captureInstr(str)
}


function addr_mode_invalid(name: string): string {
    if (DEBUG) {
        return sprintf("%s [Invalid Addressing Mode]", name)
    }
    return ""
}

function addr_mode_literal_byte(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s =%02X", name, cpu.read_U8(cpu.status.pc))
    }
    return ""
}

function addr_mode_literal_word(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s =%04X", name, cpu.read_U16(cpu.status.pc))
    }
    return ""
}

function addr_mode_direct(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s %04X", name, cpu.read_U16(cpu.status.pc))
    }
    return ""
}

function addr_mode_indirect(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (%04X)", name, cpu.read_U16(cpu.status.pc))
    }
    return ""
}

export function addr_mode_relative(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        const rel = cpu.read_I8(cpu.status.pc)
        return sprintf("%s PC%+d =%04X", name, rel, rel + cpu.status.pc + 1)
    }
    return ""
}

function addr_mode_relative_indirect(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        const rel = cpu.read_I8(cpu.status.pc)
        return sprintf("%s (PC%+d) =%04X", name, rel, rel + cpu.status.pc + 1)
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

function addr_mode_indexed_byte(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        const idx = cpu.read_U8(cpu.status.pc)
        return sprintf("%s %s", name, indexed_mode[idx & 0xf](cpu, idx >> 4, 1))
    }
    return ""
}

function addr_mode_indexed_word(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        const idx = cpu.read_U8(cpu.status.pc)
        return sprintf("%s %s", name, indexed_mode[idx & 0xf](cpu, idx >> 4, 2))
    }
    return ""
}


function addr_mode_A(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (A)", name)
    }
    return ""
}

function addr_mode_B(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (B)", name)
    }
    return ""
}

function addr_mode_X(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (X)", name)
    }
    return ""
}

function addr_mode_Y(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (Y)", name)
    }
    return ""
}

function addr_mode_Z(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (Z)", name)
    }
    return ""
}

function addr_mode_S(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (S)", name)
    }
    return ""
}

function addr_mode_C(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (C)", name)
    }
    return ""
}

function addr_mode_P(cpu: CPU6Card, name: string): string {
    if (DEBUG) {
        return sprintf("%s (P)", name)
    }
    return ""
}



/******** INDEXED ADDRESSING MODES ********/

function idx_addr_invalid(cpu: CPU6Card, idx: number, size: number) {
    return "Invalid Index Addressing Mode"
}


function idx_addr_0(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        return sprintf("(%s)", REG[reg])
    }
}


function idx_addr_1(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        return sprintf("(%s+)", REG[reg])
    }
}


function idx_addr_2(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        return sprintf("(-%s)", REG[reg])
    }
}


function idx_addr_i_0(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        return sprintf("@(%s)", REG[reg])
    }
}


function idx_addr_i_1(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        return sprintf("@(%s+)", REG[reg])
    }
}


function idx_addr_i_2(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        return sprintf("@(-%s)", REG[reg])
    }
}


function idx_addr_f_0(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        let b = cpu.read_I8(cpu.status.pc+1)
        return sprintf("(%s)%+d", REG[reg], b)
    }
}


function idx_addr_f_1(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        let b = cpu.read_I8(cpu.status.pc+1)
        return sprintf("(%s+)%+d", REG[reg], b)
    }
}


function idx_addr_f_2(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        let b = cpu.read_I8(cpu.status.pc+1)
        return sprintf("(-%s)%+d", REG[reg], b)
    }
}


function idx_addr_f_i_0(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        let b = cpu.read_I8(cpu.status.pc+1)
        return sprintf("@(%s)%+d", REG[reg], b)
    }
}


function idx_addr_f_i_1(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        let b = cpu.read_I8(cpu.status.pc+1)
        return sprintf("@(%s+)%+d", REG[reg], b)
    }
}


function idx_addr_f_i_2(cpu: CPU6Card, reg: number, size: number) {
    if (DEBUG) {
        let b = cpu.read_I8(cpu.status.pc+1)
        return sprintf("@(-%s)%+d", REG[reg], b)
    }
}

