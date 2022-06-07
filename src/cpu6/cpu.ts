/**
 * cpu.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { DEBUG } from '../defines'
import { DEBUG_captureInstr, DEBUG_captureInstrBranch, DEBUG_captureInstrWithAM, DEBUG_clear, DEBUG_fetchCapture, DEBUG_fetchCaptureAddr, DEBUG_fetchCapturePC, DEBUG_Print, DEBUG_PrintOp, DEBUG_PrintRegisters } from '../debug'

import { exit } from 'process'
import {
    mmu,
    read_I16, read_I8, read_U16, read_U8, write_I16,
    write_I8, write_U16, write_U8
} from '../memory'

import {
    REGB, REG, register_write_U8, register_read_I8, register_read_U8, register_read_I16,
    register_write_U16, register_read_U16, stack_push_U16, stack_pop_U16, stack_pop_U8, register_write_I8, register_write_I16, stack_push_U8
} from './common'

import { table_branch } from './pre_calc_tables'
import { AM_MODE_BYTE, AM_MODE_WORD, get_address } from './addressing_modes'

import { table_logic_byte, table_logic_word, table_math_mask, table_RL_byte, table_RR_byte, table_SL_byte, table_SR_byte } from './pre_calc_tables'

export const FLAG_LINK = 1
export const FLAG_MINUS = 2
export const FLAG_FAULT = 4
export const FLAG_VALUE = 8

export const FLAG_LINK_BIT = 0
export const FLAG_MINUS_BIT = 1
export const FLAG_FAULT_BIT = 2
export const FLAG_VALUE_BIT = 3

export interface DMA_Status {
    addr: number
    count: number
    enabled: boolean
    mode: number
}

export interface CPU_Status {
    pc: number
    flags: number
    ipl: number
    switches: number
    interrupt_enable: boolean
    halt: boolean
    dma: DMA_Status
    need_delay: boolean
}



export let status: CPU_Status


const opcode_table: Function[] = [
    opcode_0, opcode_1, opcode_2, opcode_3,
    opcode_4, opcode_5, opcode_6, opcode_7,
    opcode_8, opcode_9, opcode_a, opcode_b,
    opcode_c, opcode_d, opcode_e, opcode_f,
]

const opcode_0_table: Function[] = [
    op_HLT, op_NOP, op_SF, op_RF,
    op_EI, op_DI, op_SL, op_RL,
    op_CL, op_RSR, op_RI, op_RIM,
    op_ELO, op_PCX, op_DLY, op_0F
]

const opcode_2_table: Function[] = [
    op_INRB, op_DCRB, op_CLRB, op_IVRB,
    op_SRRB, op_SLRB, op_RRRB, op_RLRB,
    op_INAB, op_DCAB, op_CLAB, op_IVAB,
    op_SRAB, op_SLAB, opcode_MMU, opcode_DMA
]

const opcode_3_table: Function[] = [
    op_INR, op_DCR, op_CLR, op_IVR,
    op_SRR, op_SLR, op_RRR, op_RLR,
    op_INA, op_DCA, op_CLA, op_IVA,
    op_SRA, op_SLA, op_INX, op_DCX
]

const opcode_4_table: Function[] = [
    op_ADDB, op_SUBB, op_ANDB, op_ORIB,
    op_OREB, op_XFRB, op_NOP, opcode_BLOCK,
    op_AABB, op_SABB, op_NABB, op_XAXB,
    op_XAYB, op_XABB, op_NOP, op_NOP
]

const opcode_5_table: Function[] = [
    op_ADD, op_SUB, op_AND, op_ORI,
    op_ORE, op_XFR, op_NOP, op_NOP,
    op_AAB, op_SAB, op_NAB, op_XAX,
    op_XAY, op_XAB, op_XAZ, op_XAS
]

const opcode_6_table: Function[] = [
    op_LDX, op_LDX, op_LDX, op_LDX,
    op_LDX, op_LDX, op_LDX, op_LDX,
    op_STX, op_STX, op_STX, op_STX,
    op_STX, op_STX, op_STX, op_STX
]

const opcode_7_table: Function[] = [
    op_JMP, op_JMP, op_JMP, op_JMP,
    op_JMP, op_JMP, op_SYSCALL, op_JMP,
    op_JSR, op_JSR, op_JSR, op_JSR,
    op_JSR, op_JSR, op_PUSH, op_POP
]

const opcode_DMA_table: Function[] = [
    op_STDMA, op_LDDMA, op_STDMAC, op_LDDMAC,
    op_DMAMODE, op_NOP, op_DMAENABLE, op_NOP,
    op_NOP, op_NOP, op_NOP, op_NOP,
    op_NOP, op_NOP, op_NOP, op_NOP
]

let MMU: number[] = []

export function init_cpu() {
    status = {
        pc: 0,
        flags: 0,
        ipl: 0,
        switches: 0,
        interrupt_enable: false,
        halt: false,
        dma: {
            addr: 0,
            count: 0,
            enabled: false,
            mode: 0
        },
        need_delay: false
    }

    status.pc = 0xFC00
}

function fetchRegisters() {
    const regs = read_U8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(regs)

    return [regs >> 4, regs & 0xF] as const
}

export function triggerInterrupt(interrupt: number) {
    if (status.interrupt_enable) {
        if (interrupt > status.ipl) {
            const prev_ipl = status.ipl
           
            register_write_U16(REG.P, status.pc)

            // save flags
            let C = register_read_U16(REG.C)
            C = (C & 0x0FFF) | status.flags << 12
            register_write_U16(REG.C, C)

            // change level
            status.ipl = interrupt
            if (DEBUG) {
                DEBUG_Print("\nInterrupt Level = %d\n", interrupt)
            }

            // save previous IPL
            C = register_read_U16(REG.C)
            C = (C & 0xFF0F) | prev_ipl << 4
            register_write_U16(REG.C, C)

            // restore flags
            status.flags = (C >> 12) & 0xF

            // restore pc
            status.pc = register_read_U16(REG.P)

            status.halt = false

        }
    }
}

/**
 * Return from interrupt
 */
 function op_RI(M: number) {
    if (DEBUG) DEBUG_captureInstr("RI")
    // save pc
    register_write_U16(REG.P, status.pc)

    // get previous ipl
    let C = register_read_U16(REG.C)
    const prev_ipl = (C >> 4) & 0xF

    // save flags
    C = (C & 0x0FFF) | status.flags << 12
    register_write_U16(REG.C, C)

    // change to previous ipl
    status.ipl = prev_ipl
    if (DEBUG) {
        DEBUG_Print("\nInterrupt Level = %d\n", prev_ipl)
    }

    // restore flags
    C = register_read_U16(REG.C)
    status.flags = (C >> 12) & 0xF

    // restore pc
    status.pc = register_read_U16(REG.P)
}


/**
 * Return from Interrupt Modified
 */
function op_RIM(M: number) {
    if (DEBUG) DEBUG_captureInstr("RIM")

    // get previous ipl
    let C = register_read_U16(REG.C)
    const prev_ipl = (C >> 4) & 0xF

    // save flags
    C = (C & 0x0FFF) | status.flags << 12
    register_write_U16(REG.C, C)

    // change to previous ipl
    status.ipl = prev_ipl
    if (DEBUG) {
        DEBUG_Print("\nInterrupt Level = %d\n", prev_ipl)
    }

    // restore flags
    C = register_read_U16(REG.C)
    status.flags = (C >> 12) & 0xF

    // restore pc
    status.pc = register_read_U16(REG.P)
}

/**
 * Return from Syscall or similar (pops a byte, then the new value of rt, then a byte, then the new ipl)
 */
 function op_0F(M: number) {
    if (DEBUG) DEBUG_captureInstr("op_0F")
    const u1 = stack_pop_U8()
    const saved_x = stack_pop_U16()
    const u2 = stack_pop_U8()

    const new_ipl = stack_pop_U8()

    const x = register_read_U16(REG.X)
    const s = register_read_U16(REG.S)
    const z = register_read_U16(REG.Z)

    register_write_U16(REG.Z, status.pc - x + z)

    status.ipl = new_ipl & 0xF
    if (DEBUG) {
        DEBUG_Print("\nInterrupt Level = %d\n", new_ipl)
    }

    register_write_U16(REG.X, saved_x)
    register_write_U16(REG.S, s)
}



export let opcount = 0

export function step(): boolean {
    opcount++

    if (status.need_delay) {
        status.need_delay = false
        return false
    }

    if (!status.halt) {
        const op = read_U8(status.pc)

        if (DEBUG) {
            DEBUG_clear()
            DEBUG_fetchCapturePC(status.pc)
            DEBUG_fetchCapture(op)
            DEBUG_PrintRegisters()
        }
        status.pc++

        //console.log(`DEBUG: ${addr.toString(16)}: op=${op.toString(16)}`)
        opcode_table[op >> 4](op & 0xF)
        if (DEBUG) DEBUG_PrintOp()
        return true
    }
    else {
        return false
    }
}

/**
 * Control Opcodes
 */
function opcode_0(M: number) {
    opcode_0_table[M](M)
}

/**
 * Branch Opcodes
 */
function opcode_1(M: number) {
    let addr = status.pc
    let rel = read_I8(status.pc++)
    if (DEBUG) {
        DEBUG_fetchCapture(rel)
        DEBUG_captureInstrBranch(M, rel)
    }
    status.pc += table_branch[status.flags << 8 | M << 4 | status.switches] * rel
}

function opcode_2(M: number) {
    opcode_2_table[M](M)
}

function opcode_3(M: number) {
    opcode_3_table[M](M)
}

function opcode_4(M: number) {
    opcode_4_table[M](M)
}

function opcode_5(M: number) {
    opcode_5_table[M](M)
}

function opcode_6(M: number) {
    opcode_6_table[M](M)
}

function opcode_7(M: number) {
    opcode_7_table[M](M)
}

function opcode_8(M: number) {
    op_LDAB(M)
}

function opcode_9(M: number) {
    op_LDA(M)
}

function opcode_a(M: number) {
    op_STAB(M)
}

function opcode_b(M: number) {
    op_STA(M)
}

function opcode_c(M: number) {
    op_LDBB(M)
}

function opcode_d(M: number) {
    op_LDB(M)
}

function opcode_e(M: number) {
    op_STBB(M)
}

function opcode_f(M: number) {
    op_STB(M)
}

function opcode_MMU(M: number) {
    const MMUop = read_U8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(MMUop)
    if (MMUop == 0x0c)
        op_LDMMU(M)
    else if (MMUop == 0x1c)
        op_STMMU(M)
}

function opcode_DMA(M: number) {
    const DMAop = read_U8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(DMAop)
    opcode_DMA_table[DMAop & 0xF](DMAop >> 4)
}

function opcode_BLOCK(M: number) {
    const BLOCKop = read_U8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(BLOCKop)
    if (BLOCKop == 0x40)
        op_BCP()
    else if (BLOCKop == 0x80)
        op_BCMP()
}


/******************************************/

/**
 * Load MMU
 */
function op_LDMMU(M: number) {
    let bank = read_U8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(bank)
    const bankn = bank & 7
    let addr = read_U16(status.pc)
    if (DEBUG) DEBUG_fetchCapture(addr, 2)
    status.pc += 2

    if (DEBUG) DEBUG_captureInstr("LDMMU %d (%04X)", bankn, addr)

    if (DEBUG) {
        if (bankn < 0 || bankn > 7) {
            throw new Error(`Invalid Bank ${bankn}`)
        }
    }

    for (let i = 0; i < 32; i++) {
        const value = read_U8(addr + i)
        if (value === undefined) {
            DEBUG_Print("LDMMU value undefined: bank=%d, i=%d\n", bankn, i)
            process.exit(2)
        }
        // if (status.ipl > 0)
        //     DEBUG_Print("LDMMU bank=%02X mmuidx=%02X addr=%04X value=%02X\n", bank, (bankn << 5 | i), addr + i, value)
        mmu[bankn << 5 | i] = value
    }
}

/**
 * Store MMU
 */
function op_STMMU(M: number) {
    let bank = read_U8(status.pc++)
    if (DEBUG) DEBUG_fetchCapture(bank)
    const bankn = bank & 7
    let addr = read_U16(status.pc)
    if (DEBUG) DEBUG_fetchCapture(addr, 2)
    status.pc += 2

    if (DEBUG) DEBUG_captureInstr("STMMU %d (%04X)", bankn, addr)

    if (DEBUG) {
        if (bankn < 0 || bankn > 7) {
            throw new Error(`Invalid Bank ${bankn}`)
        }
    }

    for (let i = 0; i < 32; i++) {
        const value = mmu[bankn << 5 | i]
        if (value === undefined) {
            DEBUG_Print("STMMU value undefined: bank=%d, i=%d\n", bankn, i)
            process.exit(2)
        }
        // if (status.ipl > 0)
        //     DEBUG_Print("STMMU bank=%02X mmuidx=%02X addr=%04X value=%02X\n", bank, (bankn << 5 | i), addr + i, value)
        write_U8(addr + i, value)
    }
}


/**
 * Load DMA
 */
function op_LDDMA(reg: REG) {
    if (DEBUG) DEBUG_captureInstr("LDDMA %s", REG[reg])
    register_write_U16(reg, status.dma.addr)
}

/**
 * Store DMA
 */
function op_STDMA(reg: REG) {
    if (DEBUG) DEBUG_captureInstr("STDMA %s", REG[reg])
    status.dma.addr = register_read_U16(reg)
}

/**
 * Load DMA count
 */
function op_LDDMAC(reg: REG) {
    if (DEBUG) DEBUG_captureInstr("LDDMAC %s", REG[reg])
    register_write_U16(reg, status.dma.count)
}

/**
 * Store DMA count
 */
function op_STDMAC(reg: REG) {
    if (DEBUG) DEBUG_captureInstr("STDMAC %s", REG[reg])
    status.dma.count = register_read_U16(reg)
}

/**
 * Set DMA mode
 */
function op_DMAMODE(mode: number) {
    if (DEBUG) DEBUG_captureInstr("DMAMODE %d", mode)
    status.dma.mode = mode
}

/**
 * Enable DMA
 */
function op_DMAENABLE(reg: REG) {
    if (DEBUG) DEBUG_captureInstr("DMAENABLE %s", REG[reg])
    status.dma.enabled = true
}

/**
 * Block copy
 */
function op_BCP() {
    const len = read_U8(status.pc++)
    const src_addr = read_U16(status.pc)
    status.pc += 2
    const dest_addr = read_U16(status.pc)
    status.pc += 2
    if (DEBUG) {
        DEBUG_fetchCapture(len)
        DEBUG_fetchCapture(src_addr, 2)
        DEBUG_fetchCapture(dest_addr, 2)
        DEBUG_captureInstr("BCP %04X, (%04X), (%04X)", len, src_addr, dest_addr)
    }

    //if ((dest_addr + len) < 0x10000 && (src_addr + len) < 0x10000) {
    for (let i = 0; i < len; i++) {
        write_U8(dest_addr + i, read_U8(src_addr + i))
    }
    //}
}

/**
 * Block compare
 */
function op_BCMP() {
    const len = read_U8(status.pc++)
    const src_addr = read_U16(status.pc)
    status.pc += 2
    const dest_addr = read_U16(status.pc)
    status.pc += 2
    if (DEBUG) {
        DEBUG_fetchCapture(len)
        DEBUG_fetchCapture(src_addr, 2)
        DEBUG_fetchCapture(dest_addr, 2)
        DEBUG_captureInstr("BCMP %04X, (%04X), (%04X)", len, src_addr, dest_addr)
    }

    //    if ((dest_addr + len) < 0x10000 && (src_addr + len) < 0x10000) {
    let equal = true
    for (let i = 0; i < len; i++) {
        const src = read_U8(src_addr + i)
        const dest = read_U8(dest_addr + i)
        if (src != dest)
            equal = false
    }
    status.flags = (status.flags & 0xF7) | +equal << FLAG_VALUE_BIT
    // }
    // else {
    //     status.flags = (status.flags & 0xF7)
    // }
}


/**
 * 
 */
function op_SYSCALL(M: number) {
    if (DEBUG) DEBUG_captureInstr("SYSCALL")
    triggerInterrupt(15)
}

/**
 * 
 */
function op_POP(M: number) {
    const something = read_U8(status.pc++)
    if (DEBUG) {
        DEBUG_fetchCapture(something)
        DEBUG_captureInstr("POP %s, %s", REGB[something >> 4], REGB[something & 0xF])
    }

    register_write_U8(something & 0xF, stack_pop_U8())
    register_write_U8(something >> 4, stack_pop_U8())
}

/**
 * 
 */
function op_PUSH(M: number) {
    const something = read_U8(status.pc++)
    if (DEBUG) {
        DEBUG_fetchCapture(something)
        DEBUG_captureInstr("PUSH %s, %s", REGB[something >> 4], REGB[something & 0xF])
    }

    stack_push_U8(register_read_U8(something >> 4))
    stack_push_U8(register_read_U8(something & 0xF))
}

/**
 * Halts the CPU
 */
function op_HLT(M: number) {
    if (DEBUG) DEBUG_captureInstr("HLT")
    register_write_U16(REG.P, status.pc)
    status.halt = true
    process.stdout.write("Halted CPU\n")
    process.exit(1)
}


/**
 * No Operation
 */
function op_NOP(M: number) {
    if (DEBUG) DEBUG_captureInstr("NOP")
}


/**
 * Set Fault
 */
function op_SF(M: number) {
    if (DEBUG) DEBUG_captureInstr("SF")
    status.flags |= FLAG_FAULT
}


/**
 * Reset Fault
 */
function op_RF(M: number) {
    if (DEBUG) DEBUG_captureInstr("RF")
    status.flags &= ~FLAG_FAULT
}


/**
 * Enable the Interrupt System
 */
function op_EI(M: number) {
    if (DEBUG) DEBUG_captureInstr("EI")
    status.interrupt_enable = true
}


/**
 * Disable the Interrupt System
 */
function op_DI(M: number) {
    if (DEBUG) DEBUG_captureInstr("DI")
    status.interrupt_enable = false
}


/**
 * Set the Link/carry Flag
 */
function op_SL(M: number) {
    if (DEBUG) DEBUG_captureInstr("SL")
    status.flags |= FLAG_LINK
}


/**
 * Reset the Link/carry Flag
 */
function op_RL(M: number) {
    if (DEBUG) DEBUG_captureInstr("RL")
    status.flags &= ~FLAG_LINK
}


/**
 * Complement Link
 */
function op_CL(M: number) {
    if (DEBUG) DEBUG_captureInstr("CL")
    status.flags ^= FLAG_LINK
}


/**
 * Return from subroutine
 */
function op_RSR(M: number) {
    if (DEBUG) DEBUG_captureInstr("RSR")
    status.pc = register_read_U16(REG.X)
    register_write_U16(REG.X, stack_pop_U16())
}





/**
 * Enable Link Out
 */
function op_ELO(M: number) {
    if (DEBUG) DEBUG_captureInstr("ELO")

}


/**
 * Transfer PC to X
 */
function op_PCX(M: number) {
    if (DEBUG) DEBUG_captureInstr("PCX")
    register_write_U16(REG.X, status.pc)
}


/**
 * Delay 4.5 ms
 */
function op_DLY(M: number) {
    if (DEBUG) DEBUG_captureInstr("DLY")
    // sleep
}






/**
 * Increment byte of explicit register
 */
function op_INRB(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("INRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("INRB %s", REGB[sr])
    }
    const value = register_read_U8(sr)
    const result = (value + count + 1) & 0xFF
    register_write_U8(sr, result);
    status.flags = (status.flags & 0xF1) | table_logic_byte.flags[result & 0xFF]
    // if (result & 0x80) {
    //     if (!((value | (count+1)) & 0x80))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (value & (count+1) & 0x80)
    //         status.flags |= FLAG_FAULT
    // }
	// if (result >= 0x100)
    //     status.flags |= FLAG_LINK
}


/**
 * Decrement byte of explicit register
 */
function op_DCRB(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("DCRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("DCRB %s", REGB[sr])
    }
    const value = register_read_U8(sr)
    const result = (value - (count + 1)) & 0xFF
    register_write_U8(sr, result);
    status.flags = table_logic_byte.flags[result & 0xFF]
}


/**
 * Clear byte of explicit register (22 32 = CPU ID)
 */
function op_CLRB(M: number) {
    const [sr, value] = fetchRegisters()
    if (DEBUG) {
        if (value > 0)
            DEBUG_captureInstr("CLRB %s, %d", REGB[sr], value)
        else
            DEBUG_captureInstr("CLRB %s", REGB[sr])
    }
    register_write_U8(sr, value)
    status.flags = table_logic_byte.flags[value]
    // if (sr == REGB.BL && value == 2)
    //     status.flags |= FLAG_VALUE
}


/**
 * Invert byte of explicit register
 */
function op_IVRB(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("IVRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("IVRB %s", REGB[sr])
    }
    const value = register_read_U8(sr) ^ 0xFF
    register_write_U8(sr, value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Shift byte of explicit register right
 */
function op_SRRB(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("SRRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("SRRB %s", REGB[sr])
    }
    const value = register_read_U8(sr)
    register_write_U8(sr, table_SR_byte.data[value][count])
    status.flags = (status.flags & table_SR_byte.mask) | table_SR_byte.flags[value][count]
}


/**
 * Shift byte of explicit register left
 */
function op_SLRB(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("SLRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("SLRB %s", REGB[sr])
    }
    const value = register_read_U8(sr)
    register_write_U8(sr, table_SL_byte.data[value][count])
    status.flags = (status.flags & table_SL_byte.mask) | table_SL_byte.flags[value][count]
}


/**
 * Rotate byte of explicit register right (wraps through carry)
 */
function op_RRRB(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("RRRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("RRRB %s", REGB[sr])
    }
    const L = status.flags & FLAG_LINK
    const value = register_read_U8(sr)
    register_write_U8(sr, table_RR_byte.data[value][count][L])
    status.flags = (status.flags & table_RR_byte.mask) | table_RR_byte.flags[value][count][L]
}


/**
 * Rotate byte of explicit register left (wraps through carry)
 */
function op_RLRB(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("RLRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("RLRB %s", REGB[sr])
    }
    const L = status.flags & FLAG_LINK
    const value = register_read_U8(sr)
    register_write_U8(sr, table_RL_byte.data[value][count][L])
    status.flags = (status.flags & table_RL_byte.mask) | table_RL_byte.flags[value][count][L]
}


/**
 * Increment byte of implicit AL register
 */
function op_INAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("INAB")
    const value = register_read_U8(REGB.AL)
    const result = value + 1
    register_write_U8(REGB.AL, result)
    status.flags = (status.flags & 0xF1) | table_logic_word.flags[result & 0xFF]
    // if (result & 0x80) {
    //     if (!((value | (1)) & 0x80))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (value & (1) & 0x80)
    //         status.flags |= FLAG_FAULT
    // }
	// if (result & 0x100)
    //     status.flags |= FLAG_LINK
}


/**
 * Decrement byte of implicit AL register
 */
function op_DCAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("DCAB")
    const value = register_read_U8(REGB.AL)
    const result = value - 1
    register_write_U8(REGB.AL, result)
    status.flags = table_logic_byte.flags[result]
}


/**
 * Clear byte of implicit AL register
 */
function op_CLAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("CLAB")
    const value = 0
    register_write_U8(REGB.AL, value)
    status.flags = FLAG_VALUE
}


/**
 * Invert byte of implicit AL register
 */
function op_IVAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("IVAB")
    const value = register_read_U8(REGB.AL) ^ 0xFF
    register_write_U8(REGB.AL, value);
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Shift byte of implicit AL register left
 */
function op_SRAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("SRAB")
    const value = register_read_U8(REGB.AL)
    register_write_U8(REGB.AL, table_SR_byte.data[value][0])
    status.flags = (status.flags & table_SR_byte.mask) | table_SR_byte.flags[value][0]
}


/**
 * Shift byte of implicit AL register right
 */
function op_SLAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("SLAB")
    const value = register_read_U8(REGB.AL)
    register_write_U8(REGB.AL, table_SL_byte.data[value][0])
    status.flags = (status.flags & table_SL_byte.mask) | table_SL_byte.flags[value][0]
}


/**
 * Increment word of explicit register
 */
function op_INR(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("INR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("INR %s", REG[sr])
    }
    const value = register_read_U16(sr)
    const result = value + count + 1
    register_write_U16(sr, result)
    // if (status.pc == 0x89B8) {
    //     DEBUG_Print("count=%d, value=%d, result=%d", count, value, result)
    // }
    status.flags = (status.flags & 0xF1) | table_logic_word.flags[result & 0xFFFF]
    // if (result & 0x8000) {
    //     status.flags |= +(!((value | (count+1)) & 0x8000)) << FLAG_FAULT_BIT
    // } else {
    //     status.flags |= +(value & (count+1) & 0x8000) << FLAG_FAULT_BIT
    // }
	// if (result >= 0x10000)
    //     status.flags |= FLAG_LINK

}


/**
 * Decrement word of explicit register
 */
function op_DCR(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("DCR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("DCR %s", REG[sr])
    }
    const value = register_read_U16(sr)
    const result = value - (count + 1)
    register_write_U16(sr, result)
    status.flags = table_logic_word.flags[result & 0xFFFF]
}


/**
 * Clear word of explicit register (22 32 = CPU ID)
 */
function op_CLR(M: number) {
    const [sr, value] = fetchRegisters()
    if (DEBUG) {
        if (value > 0)
            DEBUG_captureInstr("CLR %s, %d", REG[sr], value)
        else
            DEBUG_captureInstr("CLR %s", REG[sr])
    }
    register_write_U16(sr, value)
    status.flags = table_logic_word.flags[value]
}


/**
 * Invert word of explicit register
 */
function op_IVR(M: number) {
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("IVR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("IVR %s", REG[sr])
    }
    const value = register_read_U16(sr) ^ 0xFFFF
    register_write_U16(sr, value);
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Shift word of explicit register right
 */
function op_SRR(M: number) {
    let v, r
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("SRR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("SRR %s", REG[sr])
    }
    const value = register_read_U16(sr)

    r = ((value << 16) >> 16) >> count
    v = r >> 1

    register_write_U16(sr, v & 0xFFFF)

    status.flags &= 0xF4
    if (v < 0)
        status.flags |= FLAG_MINUS
    if (v == 0)
        status.flags |= FLAG_VALUE
    if (r & 1)
        status.flags |= FLAG_LINK
}


/**
 * Shift word of explicit register left
 */
function op_SLR(M: number) {
    let v, r
    const [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("SLR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("SLR %s", REG[sr])
    }
    const value = register_read_U16(sr)

    r = (value << count) & 0xFFFF
    v = (r << 1) & 0xFFFF

    register_write_U16(sr, v)

    status.flags = 0
    if (v > 0x7FFF)
        status.flags |= FLAG_MINUS
    if (v == 0)
        status.flags |= FLAG_VALUE
    if (r > 0x7FFF)
        status.flags |= FLAG_LINK
    if (v > 0x7FFF !== r > 0x7FFF)
        status.flags |= FLAG_FAULT
}


/**
 * Rotate word of explicit register right (wraps through carry)
 */
function op_RRR(M: number) {
    let v, r
    let [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("RRR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("RRR %s", REG[sr])
    }
    const value = register_read_U16(sr)

    count++
    r = value | (status.flags & FLAG_LINK) << 16
    v = ((r >> count) | (r << (17 - count))) & 0x1FFFF

    register_write_U16(sr, v & 0xFFFF)

    status.flags &= 0xF4
    if (v & 0x8000)
        status.flags |= FLAG_MINUS
    if ((v & 0xFFFF) == 0)
        status.flags |= FLAG_VALUE
    if (v & 0x10000)
        status.flags |= FLAG_LINK
}


/**
 * Rotate word of explicit register left (wraps through carry)
 */
function op_RLR(M: number) {
    let v, r
    let [sr, count] = fetchRegisters()
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("RLR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("RLR %s", REG[sr])
    }
    const value = register_read_U16(sr)

    count++
    r = value | (status.flags & FLAG_LINK) << 16
    v = ((r << count) | (r >> (17 - count))) & 0x1FFFF

    register_write_U16(sr, v & 0xFFFF)

    status.flags = 0
    if (v & 0x8000)
        status.flags |= FLAG_MINUS
    if ((v & 0xFFFF) == 0)
        status.flags |= FLAG_VALUE
    if (v & 0x10000)
        status.flags |= FLAG_LINK
    if (((v >> 1) ^ v) & 0x8000)
        status.flags |= FLAG_FAULT
}


/**
 * Increment word of implicit A register
 */
function op_INA(M: number) {
    if (DEBUG) DEBUG_captureInstr("INA")
    const value = register_read_U16(REG.A)
    const result = value + 1
    register_write_U16(REG.A, result)
    status.flags = (status.flags & 0xF1) | table_logic_word.flags[result & 0xFFFF]
    // if (result & 0x8000) {
    //     if (!((value | (1)) & 0x8000))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (value & (1) & 0x8000)
    //         status.flags |= FLAG_FAULT
    // }
	// if (result & 0x10000)
    //     status.flags |= FLAG_LINK

}


/**
 * Decrement word of implicit A register
 */
function op_DCA(M: number) {
    if (DEBUG) DEBUG_captureInstr("DCA")
    const value = register_read_U16(REG.A)
    const result = value - 1
    register_write_U16(REG.A, result)
    status.flags = table_logic_word.flags[result]
}


/**
 * Clear word of implicit A register
 */
function op_CLA(M: number) {
    if (DEBUG) DEBUG_captureInstr("CLA")
    register_write_U16(REG.A, 0)
    status.flags = FLAG_VALUE
}


/**
 * Invert word of implicit A register
 */
function op_IVA(M: number) {
    if (DEBUG) DEBUG_captureInstr("IVA")
    const value = register_read_U16(REG.A) ^ 0xFFFF
    register_write_U16(REG.A, value);
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Shift word of implicit A register left
 */
function op_SRA(M: number) {
    if (DEBUG) DEBUG_captureInstr("SRA")
    let v, r
    const value = register_read_U16(REG.A)

    r = (value << 16) >> 16
    v = r >> 1

    register_write_U16(REG.A, v & 0xFFFF)

    status.flags &= 0xF4
    if (v < 0)
        status.flags |= FLAG_MINUS
    if (v == 0)
        status.flags |= FLAG_VALUE
    if (r & 1)
        status.flags |= FLAG_LINK
}


/**
 * Shift word of implicit A register right
 */
function op_SLA(M: number) {
    if (DEBUG) DEBUG_captureInstr("SLA")
    const value = register_read_U16(REG.A)

    const v = (value << 1) & 0xFFFF

    register_write_U16(REG.A, v)

    status.flags =
        +(v == 0) << FLAG_VALUE_BIT |
        +(v > 0x7FFF) << FLAG_MINUS_BIT |
        +(value > 0x7FFF) << FLAG_LINK_BIT |
        +(v > 0x7FFF !== value > 0x7FFF) << FLAG_FAULT_BIT
}


/**
 * Increment word of implicit X register
 */
function op_INX(M: number) {
    if (DEBUG) DEBUG_captureInstr("INX")
    const value = register_read_U16(REG.X)
    const result = value + 1
    register_write_U16(REG.X, result)
    status.flags = (status.flags & 0xF1) | table_logic_word.flags[result & 0xFFFF]
    // if (result & 0x8000) {
    //     if (!((value | (1)) & 0x8000))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (value & (1) & 0x8000)
    //         status.flags |= FLAG_FAULT
    // }
	// if (result & 0x10000)
    //     status.flags |= FLAG_LINK
}


/**
 * Decrement word of implicit X register
 */
function op_DCX(M: number) {
    if (DEBUG) DEBUG_captureInstr("DCX")
    const value = register_read_U16(REG.X)
    const result = value - 1
    register_write_U16(REG.X, result)
    status.flags = table_logic_word.flags[result & 0xFFFF]
}


/**
 * Add bytes of two explicit registers (left plus right stored in left)
 */
function op_ADDB(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("ADDB %s, %s", REGB[sr], REGB[dr])
    const dvalue = register_read_U8(dr)
    const svalue = register_read_U8(sr)
    const result = svalue + dvalue
    register_write_U8(dr, result)
    status.flags = table_logic_byte.flags[result & 0xFF] |
        +((result & 0x100) != 0) << FLAG_LINK_BIT


    // if (result & 0x80) {
    //     if (!((svalue | dvalue) & 0x80))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (svalue & dvalue & 0x80)
    //         status.flags |= FLAG_FAULT
    // }
	// if (result & 0x100)
    //     status.flags |= FLAG_LINK
}

/**
 * Subtract bytes of two explicit registers (left minus right stored in left)
 */
function op_SUBB(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("SUBB %s, %s", REGB[sr], REGB[dr])
    const svalue = register_read_I8(sr)
    const dvalue = register_read_I8(dr)
    const result = svalue - dvalue
    register_write_I8(dr, result);
    status.flags = table_logic_byte.flags[result & 0xFF] |
        +(svalue < 0 !== (dvalue < 0 && result <= 0)) << FLAG_FAULT_BIT |
        +((dvalue & 0xFFFF) <= (svalue & 0xFFFF)) << FLAG_LINK_BIT

    // if (svalue & 0x80) {
    //     if (!((dvalue | result) & 0x80))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (dvalue & result & 0x80)
    //         status.flags |= FLAG_FAULT
    // }
    // status.flags |= +((dvalue & 0xFFFFF) <= (svalue & 0xFFFFF)) << FLAG_LINK_BIT
}


/**
 * AND bytes of two explicit registers (left AND right stored in left)
 */
function op_ANDB(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("ANDB %s, %s", REGB[sr], REGB[dr])
    const value = register_read_U8(sr) & register_read_U8(dr)
    register_write_U8(dr, value);
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * OR bytes of two explicit registers (left OR right stored in left)
 */
function op_ORIB(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("ORIB %s, %s", REGB[sr], REGB[dr])
    const value = register_read_U8(sr) | register_read_U8(dr)
    register_write_U8(dr, value);
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * XOR bytes of two explicit registers (left XOR right stored in left)
 */
function op_OREB(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("OREB %s, %s", REGB[sr], REGB[dr])
    const value = register_read_U8(sr) ^ register_read_U8(dr)
    register_write_U8(dr, value);
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Copy byte of one explicit register into other explicit register (right into left)
 */
function op_XFRB(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("XFRB %s, %s", REGB[sr], REGB[dr])
    const value = register_read_U8(sr)
    register_write_U8(dr, value);
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Add bytes of implicit AL and BL (AL plus BL stored in BL)
 */
function op_AABB(M: number) {
    if (DEBUG) DEBUG_captureInstr("AABB")
    const dvalue = register_read_U8(REGB.BL)
    const svalue = register_read_U8(REGB.AL)
    const result = dvalue + svalue
    register_write_U8(REGB.BL, result);
    status.flags = table_logic_byte.flags[result & 0xFF] |
        +((result & 0x100) != 0) << FLAG_LINK_BIT


    // if (result & 0x80) {
    //     if (!((svalue | dvalue) & 0x80))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (svalue & dvalue & 0x80)
    //         status.flags |= FLAG_FAULT
    // }
	// if (result & 0x100)
    //     status.flags |= FLAG_LINK
}


/**
 * Subtract bytes of implicit AL and BL (AL minus BL stored in BL)
 */
function op_SABB(M: number) {
    if (DEBUG) DEBUG_captureInstr("SABB")
    const dvalue = register_read_I8(REGB.BL)
    const svalue = register_read_I8(REGB.AL)
    const result = svalue - dvalue
    register_write_I8(REGB.BL, result)
    status.flags = table_logic_byte.flags[result & 0xFF] |
        +(svalue < 0 !== (dvalue < 0 && result <= 0)) << FLAG_FAULT_BIT |
        +((dvalue & 0xFFFF) <= (svalue & 0xFFFF)) << FLAG_LINK_BIT

    // if (svalue & 0x80) {
    //     if (!((dvalue | result) & 0x80))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (dvalue & result & 0x80)
    //         status.flags |= FLAG_FAULT
    // }
    // status.flags |= +((dvalue & 0xFFFFF) <= (svalue & 0xFFFFF)) << FLAG_LINK_BIT
}


/**
 * AND bytes of implicit AL and BL (AL AND BL stored in BL)
 */
function op_NABB(M: number) {
    if (DEBUG) DEBUG_captureInstr("NABB")
    const value = register_read_I8(REGB.AL) & register_read_I8(REGB.BL)
    register_write_I8(REGB.BL, value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Transfer byte of implicit AL into XL
 */
function op_XAXB(M: number) {
    if (DEBUG) DEBUG_captureInstr("XAXB")
    const value = register_read_U8(REGB.AL)
    register_write_U8(REGB.XL, value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Transfer byte of implicit AL into YL
 */
function op_XAYB(M: number) {
    if (DEBUG) DEBUG_captureInstr("XAYB")
    const value = register_read_U8(REGB.AL)
    register_write_U8(REGB.YL, value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Transfer byte of implicit AL into BL
 */
function op_XABB(M: number) {
    if (DEBUG) DEBUG_captureInstr("XABB")
    const value = register_read_U8(REGB.AL)
    register_write_U8(REGB.BL, value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Load X
 */
function op_LDX(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("LDX", M & 7, AM_MODE_WORD)
    const value = read_U16(get_address(M & 7, AM_MODE_WORD))
    register_write_U16(REG.X, value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Load A
 */
function op_LDA(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("LDA", M, AM_MODE_WORD)
    const addr = get_address(M, AM_MODE_WORD)
    const value = read_U16(addr)
    register_write_U16(REG.A, value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Load AL
 */
function op_LDAB(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("LDAB", M, AM_MODE_BYTE)
    const value = read_U8(get_address(M, AM_MODE_BYTE))
    register_write_U8(REGB.AL, value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}

/**
 * Load B
 */
function op_LDB(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("LDB", M, AM_MODE_WORD)
    const value = read_U16(get_address(M, AM_MODE_WORD))
    register_write_U16(REG.B, value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Load BL
 */
function op_LDBB(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("LDBB", M, AM_MODE_BYTE)
    const value = read_U8(get_address(M, AM_MODE_BYTE))
    register_write_U8(REGB.BL, value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}

/**
 * Store AL
 */
function op_STAB(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("STAB", M, AM_MODE_BYTE)
    const value = register_read_U8(REGB.AL)
    const addr = get_address(M, AM_MODE_BYTE)
    write_U8(addr, value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}

/**
 * Store A
 */
function op_STA(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("STA", M, AM_MODE_WORD)
    const value = register_read_U16(REG.A)
    write_U16(get_address(M, AM_MODE_WORD), value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Store X
 */
function op_STX(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("STX", M & 7, AM_MODE_WORD)
    const value = register_read_U16(REG.X)
    write_U16(get_address(M & 7, AM_MODE_WORD), value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Store B
 */
function op_STB(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("STB", M, AM_MODE_WORD)
    const value = register_read_U16(REG.B)
    write_U16(get_address(M, AM_MODE_WORD), value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Store B
 */
function op_STBB(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("STBB", M, AM_MODE_BYTE)
    const value = register_read_U8(REGB.BL)
    write_U8(get_address(M, AM_MODE_BYTE), value)
    status.flags = (status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Add word of two explicit registers (left plus right stored in left)
 */
function op_ADD(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("ADD %s, %s", REG[sr], REG[dr])
    const dvalue = register_read_U16(dr)
    const svalue = register_read_U16(sr)
    const result = svalue + dvalue
    register_write_U16(dr, result)
    status.flags = table_logic_word.flags[result & 0xFFFF] |
        +((result & 0x10000) != 0) << FLAG_LINK_BIT


    // if (result & 0x8000) {
    //     if (!((svalue | dvalue) & 0x8000))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (svalue & dvalue & 0x8000)
    //         status.flags |= FLAG_FAULT
    // }
	// if (result & 0x10000)
    //     status.flags |= FLAG_LINK
}


/**
 * Subtract word of two explicit registers (left minus right stored in left)
 */
function op_SUB(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("SUB %s, %s", REG[sr], REG[dr])
    const dvalue = register_read_I16(dr)
    const svalue = register_read_I16(sr)
    const result = svalue - dvalue
    register_write_I16(dr, result);
    status.flags = table_logic_word.flags[result & 0xFFFF] |
        +(svalue < 0 !== (dvalue < 0 && result < 0)) << FLAG_FAULT_BIT |
        +((dvalue & 0xFFFF) <= (svalue & 0xFFFF)) << FLAG_LINK_BIT

    // if (svalue < 0) {
    //     if (! (dvalue < 0 && result < 0))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (dvalue < 0 && result < 0)
    //         status.flags |= FLAG_FAULT
    // }
    // status.flags |= +((dvalue & 0xFFFFF) <= (svalue & 0xFFFFF)) << FLAG_LINK_BIT

    /*

    if svalue is negative
        if not dvalue or result is negative
            set fault
    if svalue is positive or zero
        if both dvalue and result are negative
            set fault

    */
}


/**
 * AND word of two explicit registers (left AND right stored in left)
 */
function op_AND(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("AND %s, %s", REG[sr], REG[dr])
    const value = register_read_U16(sr) & register_read_U16(dr)
    register_write_U16(dr, value);
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * OR word of two explicit registers (left OR right stored in left)
 */
function op_ORI(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("ORI %s, %s", REG[sr], REG[dr])
    const value = register_read_U16(sr) | register_read_U16(dr)
    register_write_U16(dr, value);
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * XOR word of two explicit registers (left XOR right stored in left)
 */
function op_ORE(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("ORE %s, %s", REG[sr], REG[dr])
    const value = register_read_U16(sr) ^ register_read_U16(dr)
    register_write_U16(dr, value);
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Copy word of one explicit register into other explicit register (right into left)
 */
function op_XFR(M: number) {
    const [sr, dr] = fetchRegisters()
    if (DEBUG) DEBUG_captureInstr("XFR %s, %s", REG[sr], REG[dr])
    const value = register_read_U16(sr)
    register_write_U16(dr, value);
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Add word of implicit A and B (A plus B stored in B)
 */
function op_AAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("AAB")
    const dvalue = register_read_U16(REG.B)
    const svalue = register_read_U16(REG.A)
    const result = svalue + dvalue
    register_write_U16(REG.B, result);
    status.flags = table_logic_word.flags[result & 0xFFFF] |
        +((result & 0x10000) != 0) << FLAG_LINK_BIT

    // if (result & 0x8000) {
    //     if (!((svalue | dvalue) & 0x8000))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (svalue & dvalue & 0x8000)
    //         status.flags |= FLAG_FAULT
    // }
	// if (result & 0x10000)
    //     status.flags |= FLAG_LINK
}


/**
 * Subtract word of implicit A and B (A minus B stored in B)
 */
function op_SAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("SAB")
    const dvalue = register_read_I16(REG.B)
    const svalue = register_read_I16(REG.A)
    const result = svalue - dvalue
    register_write_I16(REG.B, result);
    status.flags = table_logic_word.flags[result & 0xFFFF] |
        +(svalue < 0 !== (dvalue < 0 && result <= 0)) << FLAG_FAULT_BIT |
        +((dvalue & 0xFFFF) <= (svalue & 0xFFFF)) << FLAG_LINK_BIT

    // if (value2 & 0x8000) {
    //     if (!((value | result) & 0x8000))
    //         status.flags |= FLAG_FAULT
    // } else {
    //     if (value & result & 0x8000)
    //         status.flags |= FLAG_FAULT
    // }
    //status.flags |= +((value & 0xFFFFF) <= (value2 & 0xFFFFF)) << FLAG_LINK_BIT
}


/**
 * AND word of implicit A and B (A AND B stored in B)
 */
function op_NAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("NAB")
    const A_value = register_read_U16(REG.A)
    const B_value = register_read_U16(REG.B)
    const value = A_value & B_value
    register_write_U16(REG.B, value);
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into X
 */
function op_XAX(M: number) {
    if (DEBUG) DEBUG_captureInstr("XAX")
    const value = register_read_U16(REG.A)
    register_write_U16(REG.X, value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into Y
 */
function op_XAY(M: number) {
    if (DEBUG) DEBUG_captureInstr("XAY")
    const value = register_read_U16(REG.A)
    register_write_U16(REG.Y, value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into B
 */
function op_XAB(M: number) {
    if (DEBUG) DEBUG_captureInstr("XAB")
    const value = register_read_U16(REG.A)
    register_write_U16(REG.B, value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into Z
 */
function op_XAZ(M: number) {
    if (DEBUG) DEBUG_captureInstr("XAZ")
    const value = register_read_U16(REG.A)
    register_write_U16(REG.Z, value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into S
 */
function op_XAS(M: number) {
    if (DEBUG) DEBUG_captureInstr("XAS")
    const value = register_read_U16(REG.A)
    register_write_U16(REG.S, value)
    status.flags = (status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Jump
 */
function op_JMP(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("JMP", M & 0x7, AM_MODE_WORD)
    status.pc = get_address(M, AM_MODE_WORD)
}

/**
 * Jump to Subroutine
 */
function op_JSR(M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM("JSR", M & 0x7, AM_MODE_WORD)
    const addr = get_address(M & 0x7, AM_MODE_WORD)
    if (M > 7) {
        stack_push_U16(register_read_U16(REG.X))
        register_write_U16(REG.X, status.pc)
        register_write_U16(REG.P, status.pc)
    }
    status.pc = addr
}
